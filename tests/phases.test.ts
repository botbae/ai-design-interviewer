import { describe, expect, it } from 'vitest';
import { advancePhase, isPhase, mergeConsecutive, PHASE_LIMITS, PHASE_ORDER, phaseStep, splitReply } from '@/lib/phases';

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
