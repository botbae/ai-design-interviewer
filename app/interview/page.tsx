'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { MessageList } from '@/components/interview/message-list';
import { LIMITS } from '@/lib/config';
import {
  advancePhase,
  COMPLETE_TOKEN,
  mergeConsecutive,
  PHASE_LABELS,
  phaseStep,
  splitReply,
  SKIP_TEXT,
  SPLIT_TOKEN,
  wantsToFinish,
  type ChatMessage,
  type Phase,
} from '@/lib/phases';
import { apiFetch, loadPublicConfig, readError, store, type PublicConfig } from '@/lib/browser-storage';
import type { Candidate } from '@/lib/validate';

export default function InterviewPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [error, setError] = useState('');
  const [missing, setMissing] = useState(false);
  const [phase, setPhaseState] = useState<Phase>('orientation');
  const startedRef = useRef(false);
  const phaseRef = useRef<Phase>('orientation');
  const phaseCountRef = useRef(0);

  const complete = phase === 'complete';

  function persistPhase(next: Phase, count: number) {
    phaseRef.current = next;
    phaseCountRef.current = count;
    setPhaseState(next);
    store.setPhase(next, count);
  }

  /** Jumps to the wrap-up if the interview has run past its time limit. */
  function applyTimeCap(maxMinutes: number | undefined) {
    const startedAt = store.startedAt();
    if (!maxMinutes || !startedAt) return;
    const overTime = Date.now() - startedAt > maxMinutes * 60_000;
    const idx = ['orientation', 'motivation', 'past_work', 'scenario', 'critique'].indexOf(phaseRef.current);
    if (overTime && idx > 0) persistPhase('wrap', 0);
  }

  /** Jumps to the wrap-up if the candidate asked to stop or skipped several questions in a row. */
  function finishEarlyIfAsked(history: ChatMessage[]) {
    const idx = ['orientation', 'motivation', 'past_work', 'scenario', 'critique'].indexOf(phaseRef.current);
    if (idx >= 0 && wantsToFinish(history)) persistPhase('wrap', 0);
  }

  const sendToApi = useCallback(async (history: ChatMessage[], ctx: Candidate) => {
    setLoading(true);
    setError('');
    applyTimeCap(config?.maxMinutes);
    finishEarlyIfAsked(history);
    const capturedPhase = phaseRef.current;

    let rawText = '';
    try {
      const res = await apiFetch('/api/interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: mergeConsecutive(history), candidate: ctx, phase: capturedPhase }),
      });
      if (!res.ok || !res.body) {
        setError(await readError(res, 'Something went wrong. Please try again.'));
        return;
      }

      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        rawText += decoder.decode(value, { stream: true });
        const display = rawText.split(SPLIT_TOKEN).join('\n\n').split(COMPLETE_TOKEN).join('').trimEnd();
        setMessages(prev => [...prev.slice(0, -1), { role: 'assistant', content: display }]);
      }
    } catch {
      // Network drop or interrupted stream: drop the partial reply so the user can retry cleanly.
      setMessages(history);
      setError('The connection dropped. Your answer is saved, so you can retry.');
      return;
    } finally {
      setLoading(false);
    }

    const { parts, complete: modelSaidDone } = splitReply(rawText);
    if (parts.length === 0) {
      setMessages(history);
      setError('The interviewer sent an empty reply. Please retry.');
      return;
    }
    const updated = [...history, ...parts.map(content => ({ role: 'assistant' as const, content }))];
    setMessages(updated);
    store.setTranscript(updated);

    if (capturedPhase === 'complete') return;
    if (modelSaidDone && capturedPhase === 'wrap') {
      persistPhase('complete', 0);
      return;
    }
    const next = advancePhase(capturedPhase, phaseCountRef.current + 1);
    persistPhase(next.phase, next.phaseCount);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  // Browser storage only exists after the page mounts, so it is read in an effect.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const c = store.candidate();
    if (!c) {
      setMissing(true);
      return;
    }
    setCandidate(c);
    const saved = store.transcript();
    if (saved.length > 0) {
      setMessages(saved);
      startedRef.current = true;
      persistPhase(store.phase() ?? 'orientation', store.phaseCount());
      if (saved[saved.length - 1].role === 'user') {
        setError("The interviewer's last reply didn't arrive. Tap Retry to continue.");
      }
    }
    loadPublicConfig().then(setConfig);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (candidate && !startedRef.current) {
      startedRef.current = true;
      sendToApi([], candidate);
    }
  }, [candidate, sendToApi]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || loading || !candidate) return;
    const history = [...messages, { role: 'user' as const, content }];
    setMessages(history);
    store.setTranscript(history);
    setInput('');
    await sendToApi(history, candidate);
  }

  function retry() {
    if (!candidate || loading) return;
    sendToApi(messages, candidate);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  if (missing) {
    return (
      <main className="min-h-screen bg-[#0b0f14] flex flex-col gap-4 items-center justify-center p-8 text-center">
        <p className="text-slate-300 text-sm">No resume found. Please start from the home page.</p>
        <Link href="/" className="text-sm text-violet-300 underline underline-offset-4">
          Go to the start
        </Link>
      </main>
    );
  }

  const { step, total } = phaseStep(phase);
  const lastIsUser = messages[messages.length - 1]?.role === 'user';
  const showTyping = loading && (messages.length === 0 || lastIsUser);
  const canRetry = !loading && Boolean(error) && (messages.length === 0 || lastIsUser);

  return (
    <main className="h-dvh bg-[#0b0f14] text-slate-100 flex flex-col overflow-hidden">
      <header className="shrink-0 border-b border-white/[0.05] px-4 py-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div>
          <h1 className="text-sm font-semibold text-white tracking-tight">AI Product Design Interview</h1>
          <p className="text-[10px] font-[family-name:var(--font-geist-mono)] text-slate-400 mt-0.5 tracking-wider">
            {config ? `AI interviewer · ${config.interviewerName}, ${config.interviewerRole}` : 'AI interviewer'}
          </p>
        </div>
        <div className="flex items-center gap-3">
        <Link href="/" className="inline-flex min-h-8 items-center px-1 text-xs text-slate-400 underline underline-offset-4 hover:text-slate-200">
          Exit
        </Link>
        <Badge
          variant="outline"
          aria-live="polite"
          className="border-white/[0.08] text-slate-300 text-[10px] font-[family-name:var(--font-geist-mono)] tracking-wide bg-transparent"
        >
          {complete ? 'Complete' : `Step ${step} of ${total} · ${PHASE_LABELS[phase]}`}
        </Badge>
        </div>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 sm:px-4 py-6 sm:py-8">
        <MessageList
          messages={messages}
          showTyping={showTyping}
          busy={loading}
          initials={(config?.interviewerName ?? 'AI').slice(0, 2).toUpperCase()}
        />
        {complete && (
          <div className="max-w-2xl mx-auto mt-6 flex flex-col items-center gap-3">
            <Link
              href="/report"
              className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-[#0b0f14] hover:bg-slate-100"
            >
              View your report
            </Link>
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-white/[0.05] bg-[#0b0f14] px-3 sm:px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:py-4">
        <div className="max-w-2xl mx-auto flex flex-col gap-2">
          {error && (
            <div role="alert" className="flex items-center justify-between gap-3 text-xs text-red-400">
              <span>{error}</span>
              {canRetry && (
                <button type="button" onClick={retry} className="underline underline-offset-4 text-red-300">
                  Retry
                </button>
              )}
            </div>
          )}
          <div className="flex gap-2">
            <Textarea
              id="response-input"
              aria-label="Your answer"
              value={input}
              maxLength={LIMITS.messageChars}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={2}
              placeholder={complete ? 'Ask a follow-up question…' : 'Type your answer…'}
              className="flex-1 resize-none max-h-40 bg-[#0f1520] border-white/[0.07] text-slate-200 placeholder:text-slate-400 text-base [@media(pointer:fine)]:text-sm focus-visible:border-violet-500/40 focus-visible:ring-violet-500/[0.10] rounded-xl"
            />
            <div className="flex flex-col gap-2 shrink-0">
              <Button
                onClick={() => send(input)}
                disabled={loading || !input.trim()}
                className="flex-1 min-h-11 px-5 bg-white text-[#0b0f14] hover:bg-slate-100 font-semibold text-sm rounded-xl disabled:opacity-30"
              >
                Send
              </Button>
              {!complete && (
                <button
                  type="button"
                  onClick={() => send(SKIP_TEXT)}
                  disabled={loading || messages.length === 0}
                  className="min-h-8 px-1 text-xs text-slate-400 hover:text-slate-200 disabled:opacity-30"
                >
                  Skip question
                </button>
              )}
            </div>
          </div>
          <p className="hidden [@media(pointer:fine)]:block text-[11px] text-slate-400">Enter to send, Shift+Enter for a new line.</p>
        </div>
      </div>
    </main>
  );
}
