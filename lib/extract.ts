// Reads text out of uploaded resumes and job descriptions.
//
// Accepted: PDF, Word (.docx), PNG and JPG, up to 5 MB and 10 pages.
// - Text PDFs and Word files are read directly.
// - Scanned PDFs and images have no text layer. If the configured AI can read
//   files ("vision"), it transcribes them once; otherwise we ask for pasted text.
// File types are checked from the file's first bytes, never the name.

import { LIMITS } from './config';

export type FileKind = 'pdf' | 'docx' | 'png' | 'jpeg';

export const MEDIA_TYPES: Record<FileKind, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  png: 'image/png',
  jpeg: 'image/jpeg',
};

export type ExtractResult =
  | { ok: true; text: string; truncated: boolean; via: 'text' | 'ai' }
  | { ok: false; error: string; status: number };

/** Reads an image or scanned PDF with the AI. Returns '' if nothing readable was found. */
export type Transcriber = (file: { kind: 'pdf' | 'png' | 'jpeg'; mediaType: string; base64: string }) => Promise<string>;

export const MIN_USEFUL_CHARS = 80;
export const MAX_PDF_PAGES = 10;

const PASTE_HINT = 'Please paste the text instead.';

function startsWith(bytes: Uint8Array, sig: number[]): boolean {
  return sig.every((b, i) => bytes[i] === b);
}

function containsAscii(bytes: Uint8Array, needle: string): boolean {
  const n = Array.from(needle, c => c.charCodeAt(0));
  outer: for (let i = 0; i <= bytes.length - n.length; i++) {
    for (let j = 0; j < n.length; j++) if (bytes[i + j] !== n[j]) continue outer;
    return true;
  }
  return false;
}

/** Identifies the real file type from its contents. Renamed or fake files return null. */
export function detectKind(bytes: Uint8Array): FileKind | null {
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return 'pdf'; // %PDF-
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'jpeg';
  // .docx is a zip file that contains word/document.xml
  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]) && containsAscii(bytes, 'word/document.xml')) return 'docx';
  return null;
}

/** Collapses noisy whitespace and caps the length. */
export function cleanText(text: string, maxChars: number): { text: string; truncated: boolean } {
  const cleaned = text
    .replace(/\r\n?/g, '\n')
    .replace(/[\t ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return cleaned.length > maxChars
    ? { text: cleaned.slice(0, maxChars), truncated: true }
    : { text: cleaned, truncated: false };
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    p.then(
      v => {
        clearTimeout(t);
        resolve(v);
      },
      e => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

function fail(error: string, status = 422): ExtractResult {
  return { ok: false, error, status };
}

async function readPdf(bytes: Uint8Array): Promise<{ text: string } | ExtractResult> {
  const { getDocumentProxy, extractText } = await import('unpdf');
  let doc;
  try {
    // pdf.js may take ownership of the buffer, so give it a copy.
    doc = await withTimeout(getDocumentProxy(bytes.slice()), 10_000);
  } catch (err) {
    const name = (err as { name?: string })?.name ?? '';
    if (name === 'PasswordException') return fail(`This PDF is password-protected. Remove the password or ${PASTE_HINT.toLowerCase()}`);
    if ((err as Error)?.message === 'timeout') return fail(`This PDF took too long to open. ${PASTE_HINT}`);
    return fail(`This PDF looks damaged and could not be opened. ${PASTE_HINT}`);
  }
  try {
    if (doc.numPages > MAX_PDF_PAGES) {
      return fail(`This PDF has ${doc.numPages} pages. The limit is ${MAX_PDF_PAGES}.`, 413);
    }
    const { text } = await withTimeout(extractText(doc, { mergePages: true }), 15_000);
    return { text };
  } catch {
    return fail(`We could not read the text in this PDF. ${PASTE_HINT}`);
  } finally {
    void doc.cleanup?.();
  }
}

async function readDocx(bytes: Uint8Array): Promise<{ text: string } | ExtractResult> {
  try {
    const mammoth = await import('mammoth');
    const { value } = await withTimeout(mammoth.extractRawText({ buffer: Buffer.from(bytes) }), 15_000);
    return { text: value };
  } catch {
    return fail(`This Word file looks damaged and could not be opened. ${PASTE_HINT}`);
  }
}

export async function extractDocument(
  bytes: Uint8Array,
  opts: { maxChars: number; transcribe?: Transcriber },
): Promise<ExtractResult> {
  if (bytes.byteLength === 0) return fail('The file is empty.', 400);
  if (bytes.byteLength > LIMITS.uploadBytes) return fail('The file is larger than 5 MB.', 413);

  const kind = detectKind(bytes);
  if (!kind) return fail(`Please upload a PDF, Word (.docx), PNG or JPG file, or paste the text instead.`, 415);

  let text = '';
  if (kind === 'pdf' || kind === 'docx') {
    const read = kind === 'pdf' ? await readPdf(bytes) : await readDocx(bytes);
    if ('ok' in read) return read;
    text = read.text;
  }

  let via: 'text' | 'ai' = 'text';
  if (cleanText(text, opts.maxChars).text.length < MIN_USEFUL_CHARS) {
    if (kind === 'docx') return fail(`We found almost no text in this Word file. ${PASTE_HINT}`);
    if (!opts.transcribe) {
      return fail(
        kind === 'pdf'
          ? `This PDF looks like a scan, and the AI set up here cannot read scans. ${PASTE_HINT}`
          : `The AI set up here cannot read images. ${PASTE_HINT}`,
      );
    }
    try {
      text = await withTimeout(
        opts.transcribe({ kind, mediaType: MEDIA_TYPES[kind], base64: Buffer.from(bytes).toString('base64') }),
        60_000,
      );
      via = 'ai';
    } catch {
      return fail(`We could not read this file with the AI right now. Try again or paste the text.`, 502);
    }
  }

  const cleaned = cleanText(text, opts.maxChars);
  if (cleaned.text.length < MIN_USEFUL_CHARS) return fail(`We could not find readable text in this file. ${PASTE_HINT}`);
  return { ok: true, ...cleaned, via };
}
