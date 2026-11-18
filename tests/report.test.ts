import { describe, expect, it } from 'vitest';
import { averageScore, extractJson, normalizeReport, reportToMarkdown } from '@/lib/report';

describe('report parsing', () => {
  it('reads JSON even inside a code block with extra text', () => {
    expect(extractJson('Sure!\n```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(() => extractJson('no json here')).toThrow();
  });

  it('keeps scores in range and fills every skill', () => {
    const r = normalizeReport({
      summary: 'Good.',
      competencies: [
        { id: 'ownership', score: 3, evidence: ['I led it'], note: 'clear' },
        { id: 'craft_taste', score: 9 },
        { id: 'made_up', score: 4 },
      ],
      signal: 'hire them!',
    });
    expect(r.competencies).toHaveLength(6);
    expect(r.competencies.find(c => c.id === 'ownership')?.score).toBe(3);
    expect(r.competencies.find(c => c.id === 'craft_taste')?.score).toBeNull();
    expect(r.signal).toBe('limited');
    expect(averageScore(r)).toBe(3);
  });

  it('survives garbage input', () => {
    const r = normalizeReport('nonsense');
    expect(r.summary).toMatch(/No summary/);
    expect(averageScore(r)).toBeNull();
  });

  it('exports Markdown with the human-review note', () => {
    const md = reportToMarkdown(normalizeReport({ summary: 'S', competencies: [{ id: 'ownership', score: 2, evidence: ['x'] }] }));
    expect(md).toContain('not a hiring decision');
    expect(md).toContain('| Ownership and impact | 2 / 4 |');
  });
});
