'use client';

import { useEffect, useRef, useState } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface Candidate {
  resume: string;
  github: string;
  linkedin: string;
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

  useEffect(() => {
    const stored = localStorage.getItem('candidate');
    if (!stored) {
      setError('No candidate data found. Please upload a resume first.');
      return;
    }
    const parsed: Candidate = JSON.parse(stored);
    setCandidate(parsed);
  }, []);

  useEffect(() => {
    if (candidate && !startedRef.current) {
      startedRef.current = true;
      sendToApi([], candidate);
    }
  }, [candidate]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendToApi(history: Message[], ctx: Candidate) {
    setLoading(true);
    setError('');

    const res = await fetch('/api/interview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: history, candidate: ctx }),
    });

    if (!res.ok || !res.body) {
      const err = await res.json().catch(() => ({ error: 'Request failed' }));
      setError(err.error ?? 'Request failed');
      setLoading(false);
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let assistantText = '';

    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      assistantText += decoder.decode(value, { stream: true });
      const hasSignal = assistantText.includes('[INTERVIEW_COMPLETE]');
      const displayText = assistantText.replace(/\[INTERVIEW_COMPLETE\]/g, '').trimEnd();
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: 'assistant', content: displayText };
        return updated;
      });
      if (hasSignal) setComplete(true);
    }

    setLoading(false);
  }

  async function handleSend() {
    if (!input.trim() || loading || !candidate) return;

    const userMessage: Message = { role: 'user', content: input.trim() };
    const newHistory = [...messages, userMessage];
    setMessages(newHistory);
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
      <main className="min-h-screen flex items-center justify-center p-8">
        <p className="text-red-600">{error}</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col max-w-2xl mx-auto p-4">
      <h1 className="text-xl font-bold mb-4">Interview</h1>

      <div className="flex-1 flex flex-col gap-4 overflow-y-auto mb-4">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`rounded p-3 text-sm whitespace-pre-wrap ${
              msg.role === 'assistant'
                ? 'bg-gray-100 text-gray-900'
                : 'bg-black text-white self-end max-w-lg'
            }`}
          >
            {msg.content}
          </div>
        ))}
        {loading && messages[messages.length - 1]?.role !== 'assistant' && (
          <div className="bg-gray-100 rounded p-3 text-sm text-gray-400">…</div>
        )}
        {complete && (
          <div className="text-sm text-gray-500 py-2">
            {"That's a wrap from my end. Feel free to ask any questions you have."}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {error && <p className="text-red-600 text-sm mb-2">{error}</p>}

      <div className="flex gap-2">
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
          rows={2}
          placeholder="Type your answer… (Enter to send, Shift+Enter for newline)"
          className="flex-1 border rounded px-3 py-2 text-sm resize-none disabled:opacity-50"
        />
        <button
          onClick={handleSend}
          disabled={loading || !input.trim()}
          className="bg-black text-white rounded px-4 py-2 text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </main>
  );
}
