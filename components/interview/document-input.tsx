'use client';

import { useId, useRef, useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { ACCEPT_ATTRIBUTE } from '@/lib/extract-formats';
import { apiFetch, readError } from '@/lib/browser-storage';

type Mode = 'upload' | 'paste';

interface Props {
  label: string;
  hint?: string;
  kind: 'resume' | 'jd';
  value: string;
  onChange: (text: string) => void;
  maxChars: number;
}

const labelClass =
  'text-[10px] font-[family-name:var(--font-geist-mono)] font-medium tracking-widest uppercase text-slate-400';

/** Lets people either upload a file or paste text. Both end up as plain text. */
export function DocumentInput({ label, hint, kind, value, onChange, maxChars }: Props) {
  const id = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<Mode>('upload');
  const [status, setStatus] = useState<{ tone: 'ok' | 'error' | 'busy'; text: string } | null>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setStatus({ tone: 'busy', text: `Reading ${file.name}… scans can take up to a minute.` });
    const form = new FormData();
    form.append('file', file);
    form.append('kind', kind);
    try {
      const res = await apiFetch('/api/extract', { method: 'POST', body: form });
      if (!res.ok) {
        onChange('');
        setStatus({ tone: 'error', text: await readError(res, 'Could not read that file.') });
        return;
      }
      const data = (await res.json()) as { text: string; truncated: boolean; via: 'text' | 'ai' };
      onChange(data.text);
      const parts = [`Read ${file.name}.`];
      if (data.via === 'ai') parts.push('It was a scan or image, so the AI read it. Switch to Paste to check the text.');
      if (data.truncated) parts.push('It was long, so only the first part will be used.');
      setStatus({ tone: 'ok', text: parts.join(' ') });
    } catch {
      setStatus({ tone: 'error', text: 'Network error. Please try again or paste the text.' });
    }
  }

  function switchMode(next: Mode) {
    setMode(next);
    setStatus(null);
    if (next === 'upload' && fileRef.current) fileRef.current.value = '';
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className={labelClass}>
          {label}
        </label>
        <div role="group" aria-label={`${label} input type`} className="flex gap-1 text-[11px]">
          {(['upload', 'paste'] as const).map(m => (
            <button
              key={m}
              type="button"
              onClick={() => switchMode(m)}
              aria-pressed={mode === m}
              className={`rounded-md px-3 min-h-8 transition-colors ${
                mode === m ? 'bg-white/[0.10] text-slate-200' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {m === 'upload' ? 'Upload' : 'Paste'}
            </button>
          ))}
        </div>
      </div>

      {mode === 'upload' ? (
        <div className="rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-2.5">
          <input
            ref={fileRef}
            id={id}
            type="file"
            accept={ACCEPT_ATTRIBUTE}
            onChange={e => handleFile(e.target.files?.[0])}
            className="w-full min-h-8 text-sm text-slate-400 file:mr-3 file:py-1.5 file:px-2.5 file:rounded-md file:border-0 file:text-[11px] file:font-medium file:bg-white/[0.08] file:text-slate-300 hover:file:bg-white/[0.12] cursor-pointer"
          />
        </div>
      ) : (
        <Textarea
          id={id}
          value={value}
          maxLength={maxChars}
          onChange={e => onChange(e.target.value)}
          rows={5}
          placeholder={`Paste the ${kind === 'jd' ? 'job description' : 'resume'} text here`}
          className="resize-y bg-white/[0.03] border-white/[0.07] text-slate-200 placeholder:text-slate-400 text-base [@media(pointer:fine)]:text-sm rounded-lg"
        />
      )}

      {hint && !status && <p className="text-[11px] text-slate-400">{hint}</p>}
      {status && (
        <p
          role={status.tone === 'error' ? 'alert' : 'status'}
          className={`text-[11px] ${status.tone === 'error' ? 'text-red-400' : status.tone === 'ok' ? 'text-emerald-400' : 'text-slate-400'}`}
        >
          {status.text}
        </p>
      )}
    </div>
  );
}
