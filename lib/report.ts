// Turns the model's JSON into a safe, predictable report object,
// and formats it as Markdown for download.

import { COMPETENCIES, type CompetencyId } from './prompts';

export type Signal = 'strong' | 'mixed' | 'limited';

export interface CompetencyScore {
  id: CompetencyId;
  label: string;
  score: number | null;
  evidence: string[];
  note: string;
}

export interface InterviewReport {
  summary: string;
  competencies: CompetencyScore[];
  strengths: string[];
  growthAreas: string[];
  jdFit: string | null;
  signal: Signal;
  generatedAt: string;
}

function str(v: unknown, max = 600): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

function strList(v: unknown, maxItems: number, maxLen = 300): string[] {
  if (!Array.isArray(v)) return [];
  return v.map(x => str(x, maxLen)).filter(Boolean).slice(0, maxItems);
}

/** Pulls the first {...} block out of the model's reply, even if it added extra text. */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const source = fenced ? fenced[1] : text;
  const start = source.indexOf('{');
  const end = source.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('No JSON object in reply');
  return JSON.parse(source.slice(start, end + 1));
}

export function normalizeReport(raw: unknown, now: Date = new Date()): InterviewReport {
  const r = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const given = Array.isArray(r.competencies) ? (r.competencies as Record<string, unknown>[]) : [];

  const competencies: CompetencyScore[] = COMPETENCIES.map(def => {
    const found = given.find(g => g && g.id === def.id) ?? {};
    const n = typeof found.score === 'number' ? Math.round(found.score) : null;
    return {
      id: def.id,
      label: def.label,
      score: n !== null && n >= 1 && n <= 4 ? n : null,
      evidence: strList(found.evidence, 3),
      note: str(found.note, 300),
    };
  });

  const signal: Signal = r.signal === 'strong' || r.signal === 'mixed' ? r.signal : 'limited';
  const jdFit = str(r.jd_fit) || null;

  return {
    summary: str(r.summary, 800) || 'No summary was produced.',
    competencies,
    strengths: strList(r.strengths, 3),
    growthAreas: strList(r.growth_areas, 3),
    jdFit,
    signal,
    generatedAt: now.toISOString(),
  };
}

export const SIGNAL_LABELS: Record<Signal, string> = {
  strong: 'Strong signal',
  mixed: 'Mixed signal',
  limited: 'Limited signal',
};

export function averageScore(report: InterviewReport): number | null {
  const scored = report.competencies.map(c => c.score).filter((s): s is number => s !== null);
  if (scored.length === 0) return null;
  return Math.round((scored.reduce((a, b) => a + b, 0) / scored.length) * 10) / 10;
}

export function reportToMarkdown(report: InterviewReport, candidateLabel = 'Candidate'): string {
  const avg = averageScore(report);
  const lines: string[] = [
    `# Interview summary: ${candidateLabel}`,
    '',
    `Generated ${report.generatedAt.slice(0, 10)} · ${SIGNAL_LABELS[report.signal]}${avg !== null ? ` · average ${avg} / 4` : ''}`,
    '',
    '> AI-generated summary of a first-round conversation. It is a starting point for a human reviewer, not a hiring decision.',
    '',
    '## Summary',
    report.summary,
    '',
  ];
  if (report.jdFit) lines.push('## Fit with the job description', report.jdFit, '');
  lines.push('## Scores', '', '| Skill | Score | Note |', '|---|---|---|');
  for (const c of report.competencies) {
    lines.push(`| ${c.label} | ${c.score ?? 'Not enough signal'}${c.score ? ' / 4' : ''} | ${c.note.replace(/\|/g, '/')} |`);
  }
  lines.push('', '## Evidence');
  for (const c of report.competencies) {
    if (c.evidence.length === 0) continue;
    lines.push('', `**${c.label}**`);
    for (const e of c.evidence) lines.push(`- "${e}"`);
  }
  if (report.strengths.length) lines.push('', '## Strengths', ...report.strengths.map(s => `- ${s}`));
  if (report.growthAreas.length) lines.push('', '## Areas to grow', ...report.growthAreas.map(s => `- ${s}`));
  return `${lines.join('\n')}\n`;
}
