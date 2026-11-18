'use client';

import { useEffect, useRef } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import type { ChatMessage } from '@/lib/phases';

interface Props {
  messages: ChatMessage[];
  showTyping: boolean;
  initials: string;
  /** True while a reply is streaming, so screen readers wait for the full message. */
  busy?: boolean;
}

function InterviewerAvatar({ initials }: { initials: string }) {
  return (
    <Avatar className="shrink-0 mt-1 size-7 sm:size-8 ring-1 ring-white/[0.07]">
      <AvatarFallback className="bg-[#161d2b] text-[9px] font-[family-name:var(--font-geist-mono)] font-semibold text-slate-400 tracking-widest">
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}

export function MessageList({ messages, showTyping, initials, busy = false }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    bottomRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
  }, [messages, showTyping]);

  return (
    <div role="log" aria-live="polite" aria-busy={busy} aria-label="Interview conversation" className="flex flex-col gap-5 max-w-2xl mx-auto">
      {messages.map((msg, i) =>
        msg.content ? (
          <div key={i} className={`flex gap-2 sm:gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && <InterviewerAvatar initials={initials} />}
            <div
              className={`rounded-xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap break-words max-w-[85%] sm:max-w-lg ring-1 ring-white/[0.05] ${
                msg.role === 'assistant' ? 'bg-[#0f1520] text-slate-200' : 'bg-[#1e2a3d] text-slate-100'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ) : null,
      )}

      {showTyping && (
        <div role="status" className="flex gap-2 sm:gap-3 justify-start" aria-label="Interviewer is typing">
          <InterviewerAvatar initials={initials} />
          <div className="bg-[#0f1520] ring-1 ring-white/[0.05] rounded-xl px-4 py-3.5 flex items-center gap-1.5">
            <span className="size-1.5 bg-slate-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
            <span className="size-1.5 bg-slate-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
            <span className="size-1.5 bg-slate-500 rounded-full animate-bounce" />
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
