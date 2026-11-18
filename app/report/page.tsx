'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ScoreBars } from '@/components/interview/score-bars';
import { apiFetch, readError, store } from '@/lib/browser-storage';
import { averageScore, reportToMarkdown, SIGNAL_LABELS, type InterviewReport } from '@/lib/report';

const sectionTitle = 'text-[10px] font-[family-name:var(--font-geist-mono)] tracking-widest uppercase text-slate-400';

function firstLine(text: string): string {
  return text.split('\n').find(l => l.trim())?.trim().slice(0, 60) || 'Candidate';
}

export default function ReportPage() {
  const router = useRouter();
  const [report, setReport] = useState<InterviewReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [noData, setNoData] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const generate = useCallback(async () => {
    const candidate = store.candidate();
    const messages = store.transcript();
    if (!candidate || messages.length === 0) {
      setNoData(true);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidate, messages }),
      });
      if (!res.ok) {
        setError(await readError(res, 'Could not create the report.'));
        return;
      }
      const data = (await res.json()) as { report: InterviewReport };
      store.setReport(data.report);
      setReport(data.report);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Browser storage only exists after the page mounts, so it is read in an effect.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const saved = store.report();
    if (saved) setReport(saved);
    else generate();
  }, [generate]);
  /* eslint-enable react-hooks/set-state-in-effect */

  function downloadMarkdown() {
    if (!report) return;
    const name = firstLine(store.candidate()?.resume ?? '');
    const blob = new Blob([reportToMarkdown(report, name)], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'interview-report.md';
    a.click();
    URL.revokeObjectURL(url);
  }

  function clearData() {
    store.clearAll();
    router.push('/');
  }

  if (noData) {
    return (
      <main className="min-h-screen bg-[#0b0f14] flex flex-col gap-4 items-center justify-center p-8 text-center">
        <p className="text-slate-300 text-sm">There is no finished interview in this browser yet.</p>
        <Link href="/" className="text-sm text-violet-300 underline underline-offset-4">
          Start an interview
        </Link>
      </main>
    );
  }

  const avg = report ? averageScore(report) : null;

  return (
    <main className="min-h-screen bg-[#0b0f14] text-slate-100 print:bg-white print:text-black">
      <div className="max-w-2xl mx-auto px-4 py-8 sm:py-10 flex flex-col gap-8">
        <header className="flex flex-col gap-2">
          <p className={sectionTitle}>Interview report</p>
          <h1 className="text-2xl font-semibold tracking-tight text-white print:text-black">How the conversation went</h1>
          <p className="text-xs text-slate-400 print:text-slate-700">
            AI-generated summary of a first-round conversation. It is a starting point for a human reviewer, not a hiring
            decision.
          </p>
        </header>

        {loading && (
          <p role="status" className="text-sm text-slate-300">
            Reading the conversation and writing your report… this can take up to a minute.
          </p>
        )}

        {error && (
          <div role="alert" className="flex items-center gap-3 text-sm text-red-400">
            <span>{error}</span>
            <button type="button" onClick={generate} className="underline underline-offset-4 text-red-300">
              Retry
            </button>
          </div>
        )}

        {report && (
          <>
            <section className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-3">
              <div className="rounded-xl bg-[#0f1520] ring-1 ring-white/[0.06] p-4 print:bg-white print:ring-slate-300">
                <p className={sectionTitle}>Overall</p>
                <p className="mt-1 text-lg font-semibold">{SIGNAL_LABELS[report.signal]}</p>
              </div>
              <div className="rounded-xl bg-[#0f1520] ring-1 ring-white/[0.06] p-4 print:bg-white print:ring-slate-300">
                <p className={sectionTitle}>Average score</p>
                <p className="mt-1 text-lg font-semibold">{avg !== null ? `${avg} / 4` : 'Not enough signal'}</p>
              </div>
            </section>

            <section className="flex flex-col gap-2">
              <h2 className={sectionTitle}>Summary</h2>
              <p className="text-sm leading-relaxed text-slate-200 print:text-black">{report.summary}</p>
              {report.jdFit && (
                <p className="text-sm leading-relaxed text-slate-300 print:text-black">
                  <span className="font-semibold">Fit with the role: </span>
                  {report.jdFit}
                </p>
              )}
            </section>

            <section className="flex flex-col gap-3">
              <h2 className={sectionTitle}>Skills</h2>
              <ScoreBars competencies={report.competencies} />
            </section>

            <section className="grid gap-6 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <h2 className={sectionTitle}>Strengths</h2>
                <ul className="list-disc pl-5 text-sm text-slate-200 print:text-black space-y-1">
                  {report.strengths.length ? report.strengths.map(s => <li key={s}>{s}</li>) : <li>None noted</li>}
                </ul>
              </div>
              <div className="flex flex-col gap-2">
                <h2 className={sectionTitle}>Areas to grow</h2>
                <ul className="list-disc pl-5 text-sm text-slate-200 print:text-black space-y-1">
                  {report.growthAreas.length ? report.growthAreas.map(s => <li key={s}>{s}</li>) : <li>None noted</li>}
                </ul>
              </div>
            </section>

            <section className="flex flex-col sm:flex-row sm:flex-wrap gap-2 print:hidden">
              <Button onClick={() => window.print()} className="bg-white text-[#0b0f14] hover:bg-slate-100">
                Save as PDF
              </Button>
              <Button onClick={downloadMarkdown} variant="outline" className="border-white/[0.12] bg-transparent text-slate-200">
                Download Markdown
              </Button>
              <Link href="/interview" className="px-3 py-2 text-sm text-slate-300 underline underline-offset-4">
                Back to the chat
              </Link>
              {confirmClear ? (
                <span role="group" aria-label="Confirm clearing your data" className="flex flex-wrap items-center gap-2 text-sm text-slate-300">
                  This deletes your resume, answers and report from this browser.
                  <button type="button" onClick={clearData} className="min-h-8 rounded-md bg-red-500/15 px-3 text-red-300">
                    Yes, clear it
                  </button>
                  <button type="button" onClick={() => setConfirmClear(false)} className="min-h-8 px-2 underline underline-offset-4">
                    Cancel
                  </button>
                </span>
              ) : (
                <button type="button" onClick={() => setConfirmClear(true)} className="px-3 py-2 text-sm text-slate-400 underline underline-offset-4">
                  Clear my data and start over
                </button>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
