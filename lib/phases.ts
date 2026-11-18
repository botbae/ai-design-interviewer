// The interview "rulebook". Code, not the model, decides which step is active.
// Both the browser and the server import from here so there is one source of truth.

export type Phase =
  | 'orientation'
  | 'motivation'
  | 'past_work'
  | 'scenario'
  | 'critique'
  | 'wrap'
  | 'complete';

export const PHASE_ORDER: readonly Phase[] = [
  'orientation',
  'motivation',
  'past_work',
  'scenario',
  'critique',
  'wrap',
  'complete',
];

/** Interviewer turns allowed in each step before the next one starts. */
export const PHASE_LIMITS: Readonly<Partial<Record<Phase, number>>> = {
  orientation: 1,
  motivation: 2,
  past_work: 4,
  scenario: 3,
  critique: 2,
  wrap: 1,
};

/** Friendly labels for the progress indicator. */
export const PHASE_LABELS: Readonly<Record<Phase, string>> = {
  orientation: 'Welcome',
  motivation: 'Motivation',
  past_work: 'Past work',
  scenario: 'Scenario',
  critique: 'Critique',
  wrap: 'Wrap-up',
  complete: 'Done',
};

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export function isPhase(value: unknown): value is Phase {
  return typeof value === 'string' && (PHASE_ORDER as readonly string[]).includes(value);
}

/** Counts one interviewer turn and moves to the next step when the limit is hit. */
export function advancePhase(phase: Phase, newCount: number): { phase: Phase; phaseCount: number } {
  const limit = PHASE_LIMITS[phase];
  if (limit !== undefined && newCount >= limit) {
    const idx = PHASE_ORDER.indexOf(phase);
    const next = PHASE_ORDER[Math.min(idx + 1, PHASE_ORDER.length - 1)];
    return { phase: next, phaseCount: 0 };
  }
  return { phase, phaseCount: newCount };
}

/** Step number shown to the candidate, 1-based, excluding "complete". */
export function phaseStep(phase: Phase): { step: number; total: number } {
  const total = PHASE_ORDER.length - 1;
  return { step: Math.min(PHASE_ORDER.indexOf(phase) + 1, total), total };
}

/**
 * The model APIs reject two messages in a row from the same role.
 * The UI splits replies into several bubbles, so join them back before sending.
 */
export function mergeConsecutive(msgs: ChatMessage[]): ChatMessage[] {
  return msgs.reduce<ChatMessage[]>((acc, msg) => {
    const last = acc[acc.length - 1];
    if (last && last.role === msg.role) {
      return [...acc.slice(0, -1), { role: last.role, content: `${last.content}\n\n${msg.content}` }];
    }
    return [...acc, msg];
  }, []);
}

export const SPLIT_TOKEN = '[SPLIT]';
export const COMPLETE_TOKEN = '[INTERVIEW_COMPLETE]';

/** Turns raw model text into the bubbles shown in the chat. */
export function splitReply(raw: string): { parts: string[]; complete: boolean } {
  const complete = raw.includes(COMPLETE_TOKEN);
  const parts = raw
    .split(COMPLETE_TOKEN)
    .join('')
    .split(SPLIT_TOKEN)
    .map(p => p.trim())
    .filter(p => p.length > 0);
  return { parts, complete };
}
