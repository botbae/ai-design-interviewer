'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function Home() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [github, setGithub] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleStart() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError('Please upload a PDF resume.');
      return;
    }
    setError('');
    setLoading(true);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/parse-resume', { method: 'POST', body: formData });
      if (!res.ok) {
        const err = await res.json();
        setError(err.error ?? 'Failed to parse resume.');
        return;
      }
      const data = await res.json();
      localStorage.removeItem('transcript');
      localStorage.removeItem('interviewPhase');
      localStorage.removeItem('phaseCount');
      localStorage.setItem('candidate', JSON.stringify({ resume: data.text, github, linkedin }));
      router.push('/interview');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative min-h-screen bg-[#0b0f14] text-slate-100 flex flex-col items-center justify-center p-6 overflow-hidden">
      {/* Gradient orb */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 68% 8%, rgba(124,58,237,0.08) 0%, rgba(99,102,241,0.05) 40%, transparent 70%)',
        }}
      />

      <div className="relative z-10 w-full max-w-md flex flex-col gap-10">
        {/* Heading block */}
        <div className="flex flex-col gap-4">
          <Badge
            variant="outline"
            className="w-fit font-[family-name:var(--font-geist-mono)] text-[10px] tracking-widest uppercase border-white/[0.08] text-slate-500 bg-transparent px-2.5"
          >
            Prototype · Ayan Aggarwal
          </Badge>
          <div className="flex flex-col gap-2">
            <h1 className="text-[2.6rem] font-semibold tracking-[-0.03em] text-white leading-[1.08]">
              AI Product<br />Design Interview
            </h1>
            <p className="text-sm text-slate-500 leading-relaxed max-w-[22rem]">
              Upload your resume. A structured design interview starts immediately.
            </p>
          </div>
        </div>

        {/* Form card */}
        <Card className="bg-[#0f1520] ring-white/[0.06] shadow-2xl shadow-black/60 rounded-2xl">
          <CardContent className="flex flex-col gap-5 pt-6 pb-6">
            {/* Resume upload */}
            <label htmlFor="resume-file" className="flex flex-col gap-2 cursor-pointer">
              <span className="text-[10px] font-[family-name:var(--font-geist-mono)] font-medium tracking-widest uppercase text-slate-500">
                Resume — PDF
              </span>
              <div className="rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-2.5">
                <input
                  ref={fileRef}
                  id="resume-file"
                  name="resume"
                  type="file"
                  accept="application/pdf"
                  className="w-full text-sm text-slate-400 file:mr-3 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-[11px] file:font-medium file:bg-white/[0.08] file:text-slate-300 hover:file:bg-white/[0.12] cursor-pointer"
                />
              </div>
            </label>

            {/* GitHub */}
            <label htmlFor="github-url" className="flex flex-col gap-2">
              <span className="text-[10px] font-[family-name:var(--font-geist-mono)] font-medium tracking-widest uppercase text-slate-500">
                GitHub — optional
              </span>
              <Input
                id="github-url"
                name="github"
                type="url"
                value={github}
                onChange={e => setGithub(e.target.value)}
                placeholder="https://github.com/username"
                className="bg-white/[0.03] border-white/[0.07] text-slate-200 placeholder:text-slate-700 focus-visible:border-violet-500/40 focus-visible:ring-violet-500/[0.12] h-9 text-sm rounded-lg"
              />
            </label>

            {/* LinkedIn */}
            <label htmlFor="linkedin-url" className="flex flex-col gap-2">
              <span className="text-[10px] font-[family-name:var(--font-geist-mono)] font-medium tracking-widest uppercase text-slate-500">
                LinkedIn — optional
              </span>
              <Input
                id="linkedin-url"
                name="linkedin"
                type="url"
                value={linkedin}
                onChange={e => setLinkedin(e.target.value)}
                placeholder="https://linkedin.com/in/username"
                className="bg-white/[0.03] border-white/[0.07] text-slate-200 placeholder:text-slate-700 focus-visible:border-violet-500/40 focus-visible:ring-violet-500/[0.12] h-9 text-sm rounded-lg"
              />
            </label>

            {error && (
              <p className="text-xs text-red-400">{error}</p>
            )}

            <Button
              onClick={handleStart}
              disabled={loading}
              className="w-full h-10 bg-white text-[#0b0f14] hover:bg-slate-100 font-semibold text-sm rounded-lg mt-1 transition-colors disabled:opacity-40"
            >
              {loading ? 'Parsing resume…' : 'Begin Interview'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
