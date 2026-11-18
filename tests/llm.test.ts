import { describe, expect, it } from 'vitest';
import { getLlmSettings, LlmConfigError, parseOpenAiStream, parseSseLine, tokenLimit, visionSupported } from '@/lib/llm';

describe('getLlmSettings', () => {
  it('defaults to Anthropic and reads the old key name', () => {
    const s = getLlmSettings({ ANTHROPIC_API_KEY: 'k' } as unknown as NodeJS.ProcessEnv);
    expect(s.provider).toBe('anthropic');
    expect(s.apiKey).toBe('k');
  });

  it('supports OpenAI-compatible hosts, and local ones without a key', () => {
    const s = getLlmSettings({ LLM_PROVIDER: 'openai', LLM_BASE_URL: 'http://localhost:11434/v1/', LLM_MODEL: 'llama3.2' } as unknown as NodeJS.ProcessEnv);
    expect(s.baseUrl).toBe('http://localhost:11434/v1');
    expect(s.model).toBe('llama3.2');
  });

  it('fails clearly when misconfigured', () => {
    expect(() => getLlmSettings({} as unknown as NodeJS.ProcessEnv)).toThrow(LlmConfigError);
    expect(() => getLlmSettings({ LLM_PROVIDER: 'other', LLM_API_KEY: 'k' } as unknown as NodeJS.ProcessEnv)).toThrow(LlmConfigError);
  });
});

describe('visionSupported', () => {
  const env = (e: Record<string, string>) => e as unknown as NodeJS.ProcessEnv;
  it('is on for Anthropic and OpenAI, off for other hosts unless set', () => {
    expect(visionSupported(getLlmSettings(env({ LLM_API_KEY: 'k' })), env({}))).toBe(true);
    expect(visionSupported(getLlmSettings(env({ LLM_PROVIDER: 'openai', LLM_API_KEY: 'k' })), env({}))).toBe(true);
    const groq = getLlmSettings(env({ LLM_PROVIDER: 'openai', LLM_API_KEY: 'k', LLM_BASE_URL: 'https://api.groq.com/openai/v1' }));
    expect(visionSupported(groq, env({}))).toBe(false);
    expect(visionSupported(groq, env({ LLM_VISION: 'true' }))).toBe(true);
  });
});

describe('OpenAI stream parsing', () => {
  it('reads text pieces and stops at [DONE]', async () => {
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        const enc = new TextEncoder();
        c.enqueue(enc.encode('data: {"choices":[{"delta":{"content":"Hel"}}]}\n\ndata: {"choices":[{"del'));
        c.enqueue(enc.encode('ta":{"content":"lo"}}]}\n\n: keep-alive\n\ndata: [DONE]\n\n'));
        c.close();
      },
    });
    let out = '';
    for await (const p of parseOpenAiStream(body)) out += p;
    expect(out).toBe('Hello');
  });

  it('ignores junk lines', () => {
    expect(parseSseLine('event: ping')).toBe('');
    expect(parseSseLine('data: not json')).toBe('');
    expect(parseSseLine('data: [DONE]')).toBeNull();
  });
});

describe('tokenLimit', () => {
  const env = (e: Record<string, string>) => e as unknown as NodeJS.ProcessEnv;
  it('uses max_completion_tokens for OpenAI reasoning models only', () => {
    const openai = getLlmSettings(env({ LLM_PROVIDER: 'openai', LLM_API_KEY: 'k' }));
    expect(tokenLimit(openai, 100)).toEqual({ max_completion_tokens: 400, reasoning_effort: 'low' });
    const ollama = getLlmSettings(env({ LLM_PROVIDER: 'openai', LLM_BASE_URL: 'http://localhost:11434/v1', LLM_MODEL: 'llama3.2' }));
    expect(tokenLimit(ollama, 100)).toEqual({ max_tokens: 100 });
  });

  it('keeps Cerebras reasoning light so replies are not cut off', () => {
    const base = { LLM_PROVIDER: 'openai', LLM_API_KEY: 'k', LLM_BASE_URL: 'https://api.cerebras.ai/v1' };
    expect(tokenLimit(getLlmSettings(env({ ...base, LLM_MODEL: 'gpt-oss-120b' })), 100)).toEqual({ max_completion_tokens: 400, reasoning_effort: 'low' });
    expect(tokenLimit(getLlmSettings(env({ ...base, LLM_MODEL: 'qwen-3.8-27b' })), 100)).toEqual({ max_completion_tokens: 400, reasoning_effort: 'none' });
    expect(tokenLimit(getLlmSettings(env({ ...base, LLM_MODEL: 'llama-x' })), 100)).toEqual({ max_tokens: 100 });
  });
});
