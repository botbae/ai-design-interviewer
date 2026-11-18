import type { CompetencyScore } from '@/lib/report';

const MAX = 4;

/** One horizontal bar per skill, with quoted evidence underneath. */
export function ScoreBars({ competencies }: { competencies: CompetencyScore[] }) {
  return (
    <ul className="flex flex-col gap-5">
      {competencies.map(c => (
        <li key={c.id} className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="font-medium text-slate-100 print:text-black">{c.label}</span>
            <span className="text-xs text-slate-400 print:text-slate-700">
              {c.score === null ? 'Not enough signal' : `${c.score} / ${MAX}`}
            </span>
          </div>
          <div
            role="meter"
            aria-label={`${c.label} score`}
            aria-valuemin={0}
            aria-valuemax={MAX}
            aria-valuenow={c.score ?? 0}
            aria-valuetext={c.score === null ? 'Not enough signal' : `${c.score} out of ${MAX}`}
            className="h-2 w-full rounded-full bg-white/[0.06] print:bg-slate-200 overflow-hidden"
          >
            <div
              className="h-full rounded-full bg-violet-400 print:bg-violet-700"
              style={{ width: `${((c.score ?? 0) / MAX) * 100}%` }}
            />
          </div>
          {c.note && <p className="text-xs text-slate-300 print:text-black">{c.note}</p>}
          {c.evidence.map(e => (
            <blockquote key={e} className="border-l-2 border-white/[0.12] print:border-slate-400 pl-3 text-xs italic text-slate-400 print:text-slate-700">
              “{e}”
            </blockquote>
          ))}
        </li>
      ))}
    </ul>
  );
}
