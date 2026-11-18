import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { cleanText, detectKind, extractDocument } from '@/lib/extract';

const fixture = (name: string) => new Uint8Array(readFileSync(join(__dirname, 'fixtures', name)));
const opts = { maxChars: 20_000 };

describe('detectKind', () => {
  it('checks real file contents, not names', () => {
    expect(detectKind(fixture('resume.pdf'))).toBe('pdf');
    expect(detectKind(fixture('resume.docx'))).toBe('docx');
    expect(detectKind(fixture('blank.png'))).toBe('png');
    expect(detectKind(fixture('fake.pdf'))).toBeNull();
  });
});

describe('extractDocument', () => {
  it('reads a text PDF', async () => {
    const r = await extractDocument(fixture('resume.pdf'), opts);
    expect(r.ok && r.text).toContain('Led redesign of onboarding');
    expect(r.ok && r.via).toBe('text');
  });

  it('reads a Word file', async () => {
    const r = await extractDocument(fixture('resume.docx'), opts);
    expect(r.ok && r.text).toContain('design system');
  });

  it('rejects fake, corrupt, locked and oversized files with friendly messages', async () => {
    const fake = await extractDocument(fixture('fake.pdf'), opts);
    expect(!fake.ok && fake.status).toBe(415);
    const corrupt = await extractDocument(fixture('corrupt.pdf'), opts);
    expect(!corrupt.ok && corrupt.error).toMatch(/damaged/);
    const locked = await extractDocument(fixture('encrypted.pdf'), opts);
    expect(!locked.ok && locked.error).toMatch(/password-protected/);
    const long = await extractDocument(fixture('too-many-pages.pdf'), opts);
    expect(!long.ok && long.error).toMatch(/11 pages/);
    const big = await extractDocument(new Uint8Array(6 * 1024 * 1024), opts);
    expect(!big.ok && big.status).toBe(413);
  });

  it('asks for pasted text when a scan cannot be read', async () => {
    const r = await extractDocument(fixture('scanned.pdf'), opts);
    expect(!r.ok && r.error).toMatch(/scan/);
    const img = await extractDocument(fixture('blank.png'), opts);
    expect(!img.ok && img.error).toMatch(/cannot read images/);
  });

  it('uses the AI to read scans and images when available', async () => {
    const transcribe = vi.fn().mockResolvedValue('Jordan Example\nProduct Designer with eight years of experience in fintech and onboarding flows.');
    const r = await extractDocument(fixture('scanned.pdf'), { ...opts, transcribe });
    expect(r.ok && r.via).toBe('ai');
    expect(transcribe).toHaveBeenCalledWith(expect.objectContaining({ kind: 'pdf', mediaType: 'application/pdf' }));
    const img = await extractDocument(fixture('blank.png'), { ...opts, transcribe });
    expect(img.ok).toBe(true);
  });

  it('reports when the AI finds nothing readable', async () => {
    const r = await extractDocument(fixture('blank.png'), { ...opts, transcribe: async () => '' });
    expect(!r.ok && r.error).toMatch(/could not find readable text/);
  });
});

describe('cleanText', () => {
  it('tidies whitespace and caps length', () => {
    expect(cleanText('a\t\tb\n\n\n\nc', 100)).toEqual({ text: 'a b\n\nc', truncated: false });
    expect(cleanText('abcdef', 3)).toEqual({ text: 'abc', truncated: true });
  });
});
