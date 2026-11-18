import { describe, expect, it } from 'vitest';
import {
  advancePhase,
  isLowEffort,
  isPhase,
  mergeConsecutive,
  PHASE_LIMITS,
  PHASE_ORDER,
  phaseStep,
  SKIP_TEXT,
  skipStreak,
  splitReply,
  wantsToFinish,
} from '@/lib/phases';

describe('interview steps', () => {
  it('runs every step in order and ends at complete', () => {
    let phase = PHASE_ORDER[0];
    let count = 0;
    const seen = [phase];
    let turns = 0;
    while (phase !== 'complete' && turns < 100) {
      const next = advancePhase(phase, count + 1);
      if (next.phase !== phase) seen.push(next.phase);
      phase = next.phase;
      count = next.phaseCount;
      turns++;
    }
    expect(seen).toEqual(PHASE_ORDER);
    const expected = Object.values(PHASE_LIMITS).reduce((a, b) => a + (b ?? 0), 0);
    expect(turns).toBe(expected);
  });

  it('stays in a step until its limit is reached', () => {
    expect(advancePhase('past_work', 1)).toEqual({ phase: 'past_work', phaseCount: 1 });
    expect(advancePhase('past_work', 4)).toEqual({ phase: 'scenario', phaseCount: 0 });
  });

  it('never leaves complete', () => {
    expect(advancePhase('complete', 50).phase).toBe('complete');
  });

  it('only accepts known step names', () => {
    expect(isPhase('scenario')).toBe(true);
    expect(isPhase('constructor')).toBe(false);
    expect(isPhase('__proto__')).toBe(false);
    expect(isPhase(3)).toBe(false);
  });

  it('numbers steps for the progress badge', () => {
    expect(phaseStep('orientation')).toEqual({ step: 1, total: 6 });
    expect(phaseStep('complete')).toEqual({ step: 6, total: 6 });
  });
});

describe('mergeConsecutive', () => {
  it('joins back-to-back messages from the same side', () => {
    const merged = mergeConsecutive([
      { role: 'assistant', content: 'a' },
      { role: 'assistant', content: 'b' },
      { role: 'user', content: 'c' },
    ]);
    expect(merged).toEqual([
      { role: 'assistant', content: 'a\n\nb' },
      { role: 'user', content: 'c' },
    ]);
  });
});

describe('splitReply', () => {
  it('splits bubbles and detects the end marker', () => {
    expect(splitReply('Hi[SPLIT]\nQuestion?\n[INTERVIEW_COMPLETE]')).toEqual({ parts: ['Hi', 'Question?'], complete: true });
    expect(splitReply('  ')).toEqual({ parts: [], complete: false });
  });
});

describe('skips and early finish', () => {
  const u = (content: string) => ({ role: 'user' as const, content });
  const a = (content: string) => ({ role: 'assistant' as const, content });

  it('spots skips, idk and very short answers', () => {
    for (const t of [SKIP_TEXT, 'skip', 'i dont know', 'Yes works', 'ok', '']) expect(isLowEffort(t)).toBe(true);
    expect(isLowEffort('I led the checkout redesign at Simpl')).toBe(false);
  });

  it('counts skips in a row and resets on a real answer', () => {
    expect(skipStreak([u(SKIP_TEXT), a('q'), u('idk'), a('q'), u(SKIP_TEXT)])).toBe(3);
    expect(skipStreak([u(SKIP_TEXT), a('q'), u('A real answer about my work'), a('q'), u(SKIP_TEXT)])).toBe(1);
  });

  it('finishes early on request or after three skips', () => {
    expect(wantsToFinish([a('q'), u('finish here')])).toBe(true);
    expect(wantsToFinish([a('q'), u("Let's wrap up")])).toBe(true);
    expect(wantsToFinish([a('q'), u('keep going')])).toBe(false);
    expect(wantsToFinish([u(SKIP_TEXT), a('q'), u(SKIP_TEXT)])).toBe(false);
    expect(wantsToFinish([u(SKIP_TEXT), a('q'), u(SKIP_TEXT), a('q'), u('skip')])).toBe(true);
  });
});
