'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

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
      localStorage.setItem('candidate', JSON.stringify({ resume: data.text, github, linkedin }));
      router.push('/interview');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-2xl font-bold">AI Interview Demo</h1>
      <p className="text-sm text-gray-500">AI-led Product Design Interview, a prototype by Ayan Aggarwal</p>
      <div className="flex flex-col gap-4 w-full max-w-md">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Resume (PDF)
          <input ref={fileRef} type="file" accept="application/pdf" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          GitHub URL
          <input
            type="url"
            value={github}
            onChange={e => setGithub(e.target.value)}
            className="border rounded px-3 py-2 text-sm"
            placeholder="https://github.com/username"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          LinkedIn URL
          <input
            type="url"
            value={linkedin}
            onChange={e => setLinkedin(e.target.value)}
            className="border rounded px-3 py-2 text-sm"
            placeholder="https://linkedin.com/in/username"
          />
        </label>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button
          onClick={handleStart}
          disabled={loading}
          className="bg-black text-white rounded px-4 py-2 text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
        >
          {loading ? 'Processing…' : 'Start Interview'}
        </button>
      </div>
    </main>
  );
}
