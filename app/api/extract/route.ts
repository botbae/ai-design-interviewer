import { NextRequest, NextResponse } from 'next/server';
import { getConfig, LIMITS } from '@/lib/config';
import { extractDocument, type Transcriber } from '@/lib/extract';
import { guardRequest, jsonError } from '@/lib/guard';
import { getLlmSettings, transcribeDocument, visionSupported } from '@/lib/llm';
import { dailyModelLimiter } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** The AI transcriber, if an AI that can read files is configured. */
function makeTranscriber(): Transcriber | undefined {
  try {
    const settings = getLlmSettings();
    if (!visionSupported(settings)) return undefined;
    return async file => {
      if (!dailyModelLimiter(getConfig().limits.dailyModelCalls).take('global')) {
        throw new Error('daily limit reached');
      }
      return transcribeDocument(settings, file);
    };
  } catch {
    return undefined;
  }
}

/** Accepts one uploaded file (resume or job description) and returns its text. */
export async function POST(req: NextRequest) {
  const blocked = guardRequest(req, { usesModel: false });
  if (blocked) return blocked;

  const declared = Number(req.headers.get('content-length') ?? 0);
  if (declared > LIMITS.uploadBytes + 64 * 1024) return jsonError('The file is larger than 5 MB.', 413);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return jsonError('Invalid upload', 400);
  }

  const file = form.get('file');
  if (!(file instanceof File)) return jsonError('No file uploaded', 400);
  if (file.size > LIMITS.uploadBytes) return jsonError('The file is larger than 5 MB.', 413);

  const maxChars = form.get('kind') === 'jd' ? LIMITS.jdChars : LIMITS.resumeChars;

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const result = await extractDocument(bytes, { maxChars, transcribe: makeTranscriber() });
    if (!result.ok) return jsonError(result.error, result.status);
    return NextResponse.json({ text: result.text, truncated: result.truncated, via: result.via });
  } catch (err) {
    console.error('extract failed:', err instanceof Error ? err.message : err);
    return jsonError('We could not read that file. Please paste the text instead.', 500);
  }
}
