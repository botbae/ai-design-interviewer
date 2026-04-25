'use client';

import { useEffect, useRef, useState } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';

type Phase = 'orientation' | 'motivation' | 'past_work' | 'scenario' | 'critique' | 'wrap' | 'complete';

const PHASE_LIMITS: Partial<Record<Phase, number>> = {
  orientation: 2,
  motivation: 2,
  past_work: 4,
  scenario: 3,
  critique: 2,
  wrap: 1,
};

const PHASE_ORDER: Phase[] = ['orientation', 'motivation', 'past_work', 'scenario', 'critique', 'wrap', 'complete'];

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface Candidate {
  resume: string;
  github: string;
  linkedin: string;
}

const TRANSCRIPT_KEY = 'transcript';
const PHASE_KEY = 'interviewPhase';
const PHASE_COUNT_KEY = 'phaseCount';

function mergeConsecutive(msgs: Message[]): Message[] {
  return msgs.reduce<Message[]>((acc, msg) => {
    const last = acc[acc.length - 1];
    if (last && last.role === msg.role) {
      return [...acc.slice(0, -1), { role: last.role, content: last.content + '\n\n' + msg.content }];
    }
    return [...acc, msg];
  }, []);
}

function advancePhase(phase: Phase, newCount: number): { phase: Phase; phaseCount: number } {
  const limit = PHASE_LIMITS[phase];
  if (limit !== undefined && newCount >= limit) {
    const idx = PHASE_ORDER.indexOf(phase);
    const next = PHASE_ORDER[Math.min(idx + 1, PHASE_ORDER.length - 1)];
    return { phase: next, phaseCount: 0 };
  }
  return { phase, phaseCount: newCount };
}

export default function InterviewPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [error, setError] = useState('');
  const [complete, setComplete] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const startedRef = useRef(false);
  const phaseRef = useRef<Phase>('orientation');
  const phaseCountRef = useRef(0);

  useEffect(() => {
    const stored = localStorage.getItem('candidate');
    if (!stored) {
      setError('No candidate data found. Please upload a resume first.');
      return;
    }
    const parsed: Candidate = JSON.parse(stored);
    setCandidate(parsed);

    const savedTranscript = localStorage.getItem(TRANSCRIPT_KEY);
    const savedPhase = localStorage.getItem(PHASE_KEY) as Phase | null;
    const savedCount = localStorage.getItem(PHASE_COUNT_KEY);

    if (savedTranscript) {
      try {
        const saved: Message[] = JSON.parse(savedTranscript);
        if (saved.length > 0) {
          setMessages(saved);
          startedRef.current = true;
          if (savedPhase) phaseRef.current = savedPhase;
          if (savedCount) phaseCountRef.current = parseInt(savedCount, 10);
          if (savedPhase === 'complete') setComplete(true);
        }
      } catch {
        // corrupt — ignore and start fresh
      }
    }
  }, []);

  useEffect(() => {
    if (candidate && !startedRef.current) {
      startedRef.current = true;
      sendToApi([], candidate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidate]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function saveTranscript(msgs: Message[]) {
    localStorage.setItem(TRANSCRIPT_KEY, JSON.stringify(msgs));
  }

  function persistPhase(phase: Phase, count: number) {
    phaseRef.current = phase;
    phaseCountRef.current = count;
    localStorage.setItem(PHASE_KEY, phase);
    localStorage.setItem(PHASE_COUNT_KEY, String(count));
  }

  async function sendToApi(history: Message[], ctx: Candidate) {
    setLoading(true);
    setError('');

    const capturedPhase = phaseRef.current;
    const apiMessages = mergeConsecutive(history);

    const res = await fetch('/api/interview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: apiMessages, candidate: ctx, phase: capturedPhase }),
    });

    if (!res.ok || !res.body) {
      const err = await res.json().catch(() => ({ error: 'Request failed' }));
      setError(err.error ?? 'Request failed');
      setLoading(false);
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let rawText = '';

    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      rawText += decoder.decode(value, { stream: true });
      const displayText = rawText
        .replace(/\[SPLIT\]/g, '\n\n')
        .replace(/\[INTERVIEW_COMPLETE\]/g, '')
        .trimEnd();
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: 'assistant', content: displayText };
        return updated;
      });
    }

    const hasComplete = rawText.includes('[INTERVIEW_COMPLETE]');
    const cleanedText = rawText.replace(/\[INTERVIEW_COMPLETE\]/g, '').trim();
    const parts = cleanedText
      .split('[SPLIT]')
      .map(p => p.trim())
      .filter(p => p.length > 0);

    const newAssistantMessages: Message[] = parts.map(content => ({ role: 'assistant', content }));

    setMessages(prev => {
      const withoutPlaceholder = prev.slice(0, -1);
      const updated = [...withoutPlaceholder, ...newAssistantMessages];
      saveTranscript(updated);
      return updated;
    });

    if (hasComplete) {
      setComplete(true);
      persistPhase('complete', 0);
    } else if (capturedPhase !== 'complete') {
      const newCount = phaseCountRef.current + 1;
      const { phase: nextPhase, phaseCount: nextCount } = advancePhase(capturedPhase, newCount);
      persistPhase(nextPhase, nextCount);
    }

    setLoading(false);
  }

  async function handleSend() {
    if (!input.trim() || loading || !candidate) return;
    const userMessage: Message = { role: 'user', content: input.trim() };
    const newHistory = [...messages, userMessage];
    setMessages(newHistory);
    saveTranscript(newHistory);
    setInput('');
    await sendToApi(newHistory, candidate);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  if (error && !candidate) {
    return (
      <main className="min-h-screen bg-[#0b0f14] flex items-center justify-center p-8">
        <p className="text-red-400 text-sm">{error}</p>
      </main>
    );
  }

  const showTypingIndicator =
    loading && (messages.length === 0 || messages[messages.length - 1]?.role !== 'assistant');

  return (
    <main className="min-h-screen bg-[#0b0f14] text-slate-100 flex flex-col">
      {/* Header */}
      <header className="shrink-0 border-b border-white/[0.05] px-4 py-3 text-center">
        <p className="text-sm font-semibold text-white tracking-tight">
          AI Product Design Interview
        </p>
        <p className="text-[10px] font-[family-name:var(--font-geist-mono)] text-slate-600 mt-0.5 tracking-wider">
          Prototype · Ayan Aggarwal
        </p>
      </header>

      {/* AI disclosure banner */}
      <div className="shrink-0 border-b border-white/[0.04] bg-white/[0.015] px-4 py-2 flex justify-center">
        <Badge
          variant="outline"
          className="border-white/[0.06] text-slate-500 text-[10px] font-[family-name:var(--font-geist-mono)] tracking-wide bg-transparent"
        >
          AI-led · Speaking as Ayan Aggarwal, Product Designer at Alt Inc.
        </Badge>
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-4 py-8">
        <div role="log" aria-live="polite" aria-label="Interview conversation" className="flex flex-col gap-5 max-w-2xl mx-auto">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <Avatar className="shrink-0 mt-1 size-8 ring-1 ring-white/[0.07]">
                  <AvatarFallback className="bg-[#161d2b] text-[9px] font-[family-name:var(--font-geist-mono)] font-semibold text-slate-500 tracking-widest">
                    AA
                  </AvatarFallback>
                </Avatar>
              )}
              <div
                className={`rounded-xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap max-w-lg ${
                  msg.role === 'assistant'
                    ? 'bg-[#0f1520] text-slate-200 ring-1 ring-white/[0.05] border-l-2 border-violet-500/30'
                    : 'bg-[#1e2a3d] text-slate-100 ring-1 ring-white/[0.05]'
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {showTypingIndicator && (
            <div className="flex gap-3 justify-start">
              <Avatar className="shrink-0 mt-1 size-8 ring-1 ring-white/[0.07]">
                <AvatarFallback className="bg-[#161d2b] text-[9px] font-[family-name:var(--font-geist-mono)] font-semibold text-slate-500 tracking-widest">
                  AA
                </AvatarFallback>
              </Avatar>
              <div className="bg-[#0f1520] ring-1 ring-white/[0.05] border-l-2 border-violet-500/30 rounded-xl px-4 py-3.5 flex items-center gap-1.5">
                <span className="size-1.5 bg-slate-600 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <span className="size-1.5 bg-slate-600 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <span className="size-1.5 bg-slate-600 rounded-full animate-bounce" />
              </div>
            </div>
          )}

          {/* Interview complete */}
          {complete && (
            <div className="flex items-center gap-4 py-4">
              <div className="flex-1 h-px bg-white/[0.05]" />
              <p className="text-[10px] font-[family-name:var(--font-geist-mono)] text-slate-600 tracking-widest uppercase">
                Interview complete
              </p>
              <div className="flex-1 h-px bg-white/[0.05]" />
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input dock */}
      <div className="shrink-0 border-t border-white/[0.05] bg-[#0b0f14] px-4 py-4">
        <div className="max-w-2xl mx-auto flex flex-col gap-2">
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <div className="flex gap-2">
            <Textarea
              id="response-input"
              name="response"
              aria-label="Your answer"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={2}
              placeholder="Type your answer… (Enter to send, Shift+Enter for newline)"
              className="flex-1 resize-none bg-[#0f1520] border-white/[0.07] text-slate-200 placeholder:text-slate-700 text-sm focus-visible:border-violet-500/40 focus-visible:ring-violet-500/[0.10] rounded-xl"
            />
            <Button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="shrink-0 self-stretch px-5 bg-white text-[#0b0f14] hover:bg-slate-100 font-semibold text-sm rounded-xl disabled:opacity-30 transition-colors"
            >
              Send
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}
