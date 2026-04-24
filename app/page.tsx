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
      localStorage.removeItem('transcript');
      localStorage.setItem('candidate', JSON.stringify({ resume: data.text, github, linkedin }));
      router.push('/interview');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100 flex flex-col items-center justify-center gap-6 p-8">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-white">AI Product Design Interview</h1>
        <p className="text-sm text-gray-500 mt-1">AI-led Product Design Interview, a prototype by Ayan Aggarwal</p>
      </div>

      <div className="flex flex-col gap-4 w-full max-w-md">
        <label className="flex flex-col gap-1 text-sm font-medium text-gray-300">
          Resume (PDF)
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf"
            className="text-gray-300 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:bg-gray-800 file:text-gray-200 hover:file:bg-gray-700 cursor-pointer"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium text-gray-300">
          GitHub URL
          <input
            type="url"
            value={github}
            onChange={e => setGithub(e.target.value)}
            className="border border-gray-700 rounded px-3 py-2 text-sm bg-gray-900 text-gray-100 placeholder:text-gray-600 focus:outline-none focus:border-gray-500"
            placeholder="https://github.com/username"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium text-gray-300">
          LinkedIn URL
          <input
            type="url"
            value={linkedin}
            onChange={e => setLinkedin(e.target.value)}
            className="border border-gray-700 rounded px-3 py-2 text-sm bg-gray-900 text-gray-100 placeholder:text-gray-600 focus:outline-none focus:border-gray-500"
            placeholder="https://linkedin.com/in/username"
          />
        </label>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <button
          onClick={handleStart}
          disabled={loading}
          className="bg-white text-gray-900 rounded px-4 py-2 text-sm font-medium hover:bg-gray-200 disabled:opacity-50"
        >
          {loading ? 'Processing…' : 'Start Interview'}
        </button>
      </div>
    </main>
  );
}
