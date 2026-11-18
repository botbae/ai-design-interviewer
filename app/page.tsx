'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DocumentInput } from '@/components/interview/document-input';
import { LIMITS } from '@/lib/config';
import { FORMATS_HINT } from '@/lib/extract-formats';
import { loadPublicConfig, store, type PublicConfig } from '@/lib/browser-storage';

const labelClass =
  'text-[10px] font-[family-name:var(--font-geist-mono)] font-medium tracking-widest uppercase text-slate-400';
const inputClass =
  'bg-white/[0.03] border-white/[0.07] text-slate-200 placeholder:text-slate-400 focus-visible:border-violet-500/40 focus-visible:ring-violet-500/[0.12] h-10 text-base [@media(pointer:fine)]:text-sm rounded-lg';

export default function Home() {
  const router = useRouter();
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [resume, setResume] = useState('');
  const [jd, setJd] = useState('');
  const [github, setGithub] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [error, setError] = useState('');
  const [canResume, setCanResume] = useState(false);
  const errorRef = useRef<HTMLParagraphElement>(null);

  // Move focus to the error so keyboard and screen-reader users hear it.
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  // Browser storage only exists after the page mounts, so it is read in an effect.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    loadPublicConfig().then(setConfig);
    setAccessCode(store.accessCode());
    setCanResume(store.transcript().length > 0 && store.candidate() !== null);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  function handleStart() {
    if (resume.trim().length < 80) {
      setError('Please add your resume first, as a file or pasted text.');
      return;
    }
    if (config?.accessCodeRequired && !accessCode.trim()) {
      setError('Please enter the access code.');
      return;
    }
    setError('');
    store.setAccessCode(accessCode.trim());
    store.startNew({ resume: resume.trim(), jd: jd.trim(), github: github.trim(), linkedin: linkedin.trim() });
    router.push('/interview');
  }

  return (
    <main className="relative min-h-screen bg-[#0b0f14] text-slate-100 flex flex-col items-center justify-center px-4 py-6 sm:p-6 overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 68% 8%, rgba(124,58,237,0.08) 0%, rgba(99,102,241,0.05) 40%, transparent 70%)',
        }}
      />

      <div className="relative z-10 w-full max-w-md flex flex-col gap-10 py-10">
        <div className="flex flex-col gap-4">
          <Badge
            variant="outline"
            className="w-fit font-[family-name:var(--font-geist-mono)] text-[10px] tracking-widest uppercase border-white/[0.08] text-slate-400 bg-transparent px-2.5"
          >
            Open-source prototype
          </Badge>
          <div className="flex flex-col gap-2">
            <h1 className="text-[2.1rem] sm:text-[2.6rem] font-semibold tracking-[-0.03em] text-white leading-[1.08]">
              AI Product<br />Design Interview
            </h1>
            <p className="text-sm text-slate-400 leading-relaxed max-w-[24rem]">
              Practice a first-round product design interview. Add your resume and, if you have one, the job
              description. You get a summary report at the end.
            </p>
          </div>
        </div>

        {canResume && (
          <p className="text-sm text-slate-300">
            You have an interview in progress.{' '}
            <Link href="/interview" className="text-violet-300 underline underline-offset-4">
              Continue it
            </Link>{' '}
            or start a new one below.
          </p>
        )}

        <Card className="bg-[#0f1520] ring-white/[0.06] shadow-2xl shadow-black/60 rounded-2xl">
          <CardContent className="flex flex-col gap-6 pt-6 pb-6">
            {config?.accessCodeRequired && (
              <label htmlFor="access-code" className="flex flex-col gap-2">
                <span className={labelClass}>Access code</span>
                <Input
                  id="access-code"
                  type="password"
                  autoComplete="off"
                  value={accessCode}
                  onChange={e => {
                    setAccessCode(e.target.value);
                    // Save right away so file uploads can use it too.
                    store.setAccessCode(e.target.value.trim());
                  }}
                  className={inputClass}
                />
              </label>
            )}

            <DocumentInput
              label="Resume"
              kind="resume"
              value={resume}
              onChange={setResume}
              maxChars={LIMITS.resumeChars}
              hint={FORMATS_HINT}
            />

            <DocumentInput
              label="Job description (optional)"
              kind="jd"
              value={jd}
              onChange={setJd}
              maxChars={LIMITS.jdChars}
              hint="Tailors the questions and the report to the role. Same file types as above."
            />

            <label htmlFor="github-url" className="flex flex-col gap-2">
              <span className={labelClass}>GitHub or portfolio link (optional)</span>
              <Input
                id="github-url"
                type="url"
                maxLength={LIMITS.linkChars}
                value={github}
                onChange={e => setGithub(e.target.value)}
                placeholder="https://github.com/username"
                className={inputClass}
              />
            </label>

            <label htmlFor="linkedin-url" className="flex flex-col gap-2">
              <span className={labelClass}>LinkedIn link (optional)</span>
              <Input
                id="linkedin-url"
                type="url"
                maxLength={LIMITS.linkChars}
                value={linkedin}
                onChange={e => setLinkedin(e.target.value)}
                placeholder="https://linkedin.com/in/username"
                className={inputClass}
              />
              <span className="text-[11px] text-slate-400">
                Links are shared as text only. The interviewer does not open them.
              </span>
            </label>


            {error && (
              <p ref={errorRef} tabIndex={-1} role="alert" className="text-xs text-red-400">
                {error}
              </p>
            )}

            <Button
              onClick={handleStart}
              className="w-full h-11 bg-white text-[#0b0f14] hover:bg-slate-100 font-semibold text-sm rounded-lg mt-1 transition-colors disabled:opacity-40"
            >
              Begin interview
            </Button>

            <p className="text-[11px] leading-relaxed text-slate-400">
              Your resume, job description and answers are sent to the AI provider to run the interview. Nothing is
              stored on this server. Everything stays in your browser until you clear it.
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
