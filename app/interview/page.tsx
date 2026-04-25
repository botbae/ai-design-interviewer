'use client';

import { useEffect, useRef, useState } from 'react';

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
  // Refs so async sendToApi always reads current phase state
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
      <main className="min-h-screen bg-gray-950 flex items-center justify-center p-8">
        <p className="text-red-400">{error}</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
      <header className="border-b border-gray-800 px-4 py-3 text-center shrink-0">
        <p className="text-sm font-semibold text-white">AI Product Design Interview</p>
        <p className="text-xs text-gray-500">Prototype by Ayan Aggarwal</p>
      </header>

      <div className="bg-gray-900 border-b border-gray-800 px-4 py-2 text-center shrink-0">
        <p className="text-xs text-gray-400">
          {"You're chatting with Ayan Aggarwal, Product Designer at Alt Inc. This is an AI-led interview prototype."}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="flex flex-col gap-4 max-w-2xl mx-auto">
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="shrink-0 w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs font-semibold text-white">
                  AA
                </div>
              )}
              <div
                className={`rounded-lg px-3 py-2 text-sm whitespace-pre-wrap max-w-lg ${
                  msg.role === 'assistant'
                    ? 'bg-gray-800 text-gray-100'
                    : 'bg-white text-gray-900'
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {loading && messages[messages.length - 1]?.role !== 'assistant' && (
            <div className="flex gap-3 justify-start">
              <div className="shrink-0 w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs font-semibold text-white">
                AA
              </div>
              <div className="bg-gray-800 rounded-lg px-3 py-2 text-sm text-gray-500">…</div>
            </div>
          )}

          {complete && (
            <p className="text-xs text-gray-500 text-center py-2">
              {"That's a wrap from my end. Feel free to ask any questions you have."}
            </p>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      <div className="border-t border-gray-800 px-4 py-3 shrink-0">
        <div className="max-w-2xl mx-auto">
          {error && <p className="text-red-400 text-sm mb-2">{error}</p>}
          <div className="flex gap-2">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={2}
              placeholder="Type your answer… (Enter to send, Shift+Enter for newline)"
              className="flex-1 border border-gray-700 rounded-lg px-3 py-2 text-sm resize-none bg-gray-900 text-gray-100 placeholder:text-gray-600 focus:outline-none focus:border-gray-500"
            />
            <button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="bg-white text-gray-900 rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-200 disabled:opacity-40"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
