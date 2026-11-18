import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/llm', async importOriginal => {
  const real = await importOriginal<typeof import('@/lib/llm')>();
  return {
    ...real,
    streamText: vi.fn(async function* () {
      yield 'Hello';
      yield '[SPLIT]How are you?';
    }),
    completeText: vi.fn(async () => '{"summary":"Solid.","competencies":[{"id":"ownership","score":3,"evidence":["I led it"]}],"signal":"mixed"}'),
  };
});

const candidate = { resume: 'Jordan, product designer with five years of experience.' };

function post(url: string, body: unknown, headers: Record<string, string> = {}) {
  return new Request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': String(Math.random()), ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  }) as unknown as import('next/server').NextRequest;
}

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
  vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');
});

describe('POST /api/interview', () => {
  it('streams the reply', async () => {
    const { POST } = await import('@/app/api/interview/route');
    const res = await POST(post('http://x/api/interview', { candidate, messages: [] }));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('Hello[SPLIT]How are you?');
  });

  it('returns 400 for bad input instead of crashing', async () => {
    const { POST } = await import('@/app/api/interview/route');
    expect((await POST(post('http://x/api/interview', '{nope'))).status).toBe(400);
    expect((await POST(post('http://x/api/interview', { candidate, messages: 'abc' }))).status).toBe(400);
  });

  it('returns 503 with a clear message when no key is set', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    const { POST } = await import('@/app/api/interview/route');
    const res = await POST(post('http://x/api/interview', { candidate }));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toMatch(/not set up/);
  });

  it('enforces the access code when one is set', async () => {
    vi.stubEnv('ACCESS_CODE', 'letmein');
    const { POST } = await import('@/app/api/interview/route');
    expect((await POST(post('http://x/api/interview', { candidate }))).status).toBe(401);
    expect((await POST(post('http://x/api/interview', { candidate }, { 'x-access-code': 'letmein' }))).status).toBe(200);
  });

  it('rate-limits one visitor', async () => {
    vi.stubEnv('RATE_LIMIT_PER_MINUTE', '2');
    const { POST } = await import('@/app/api/interview/route');
    const h = { 'x-forwarded-for': '9.9.9.9' };
    const codes = [];
    for (let i = 0; i < 3; i++) codes.push((await POST(post('http://x/api/interview', { candidate }, h))).status);
    expect(codes).toEqual([200, 200, 429]);
  });
});

describe('POST /api/report', () => {
  it('returns a cleaned-up report', async () => {
    const { POST } = await import('@/app/api/report/route');
    const res = await POST(post('http://x/api/report', { candidate, messages: [{ role: 'user', content: 'I led it' }] }));
    expect(res.status).toBe(200);
    const { report } = await res.json();
    expect(report.competencies).toHaveLength(6);
    expect(report.signal).toBe('mixed');
  });
});

describe('GET /api/config', () => {
  it('never exposes secrets', async () => {
    vi.stubEnv('ACCESS_CODE', 'letmein');
    const { GET } = await import('@/app/api/config/route');
    const text = await GET().text();
    expect(text).not.toContain('test-key');
    expect(text).not.toContain('letmein');
    expect(JSON.parse(text).accessCodeRequired).toBe(true);
  });
});
