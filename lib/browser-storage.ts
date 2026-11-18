'use client';

// Everything about one interview lives in this browser only.
// Nothing is saved on the server.

import { isPhase, type ChatMessage, type Phase } from './phases';
import type { InterviewReport } from './report';
import type { Candidate } from './validate';

const KEYS = {
  candidate: 'candidate',
  transcript: 'transcript',
  phase: 'interviewPhase',
  phaseCount: 'phaseCount',
  startedAt: 'startedAt',
  report: 'report',
  accessCode: 'accessCode',
} as const;

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? null : (JSON.parse(raw) as T);
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked (private mode). The interview still works for this tab.
  }
}

export const store = {
  candidate: () => read<Candidate>(KEYS.candidate),
  transcript: () => read<ChatMessage[]>(KEYS.transcript) ?? [],
  phase: (): Phase | null => {
    // Older versions saved the step as a plain string, newer ones as JSON. Accept both.
    try {
      const raw = localStorage.getItem(KEYS.phase);
      if (isPhase(raw)) return raw;
    } catch {
      return null;
    }
    const parsed = read<unknown>(KEYS.phase);
    return isPhase(parsed) ? parsed : null;
  },
  phaseCount: () => {
    const n = Number(read<number>(KEYS.phaseCount));
    return Number.isInteger(n) && n >= 0 ? n : 0;
  },
  startedAt: () => read<number>(KEYS.startedAt),
  report: () => read<InterviewReport>(KEYS.report),
  accessCode: () => read<string>(KEYS.accessCode) ?? '',

  setTranscript: (m: ChatMessage[]) => write(KEYS.transcript, m),
  setPhase: (p: Phase, count: number) => {
    write(KEYS.phase, p);
    write(KEYS.phaseCount, count);
  },
  setReport: (r: InterviewReport) => write(KEYS.report, r),
  setAccessCode: (c: string) => write(KEYS.accessCode, c),

  /** Starts a fresh interview and forgets the previous one. */
  startNew: (c: Candidate) => {
    for (const k of [KEYS.transcript, KEYS.phase, KEYS.phaseCount, KEYS.report]) {
      try { localStorage.removeItem(k); } catch { /* ignore */ }
    }
    write(KEYS.candidate, c);
    write(KEYS.startedAt, Date.now());
  },

  /** Removes the resume, answers and report from this browser. */
  clearAll: () => {
    for (const k of Object.values(KEYS)) {
      if (k === KEYS.accessCode) continue;
      try { localStorage.removeItem(k); } catch { /* ignore */ }
    }
  },
};

/** fetch() that adds the optional access code. */
export function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const code = store.accessCode();
  if (code) headers.set('x-access-code', code);
  return fetch(path, { ...init, headers });
}

export async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json();
    return typeof data?.error === 'string' ? data.error : fallback;
  } catch {
    return fallback;
  }
}

export interface PublicConfig {
  interviewerName: string;
  interviewerRole: string;
  companyName: string;
  accessCodeRequired: boolean;
  maxMinutes: number;
}

export async function loadPublicConfig(): Promise<PublicConfig | null> {
  try {
    const res = await fetch('/api/config', { cache: 'no-store' });
    return res.ok ? ((await res.json()) as PublicConfig) : null;
  } catch {
    return null;
  }
}
