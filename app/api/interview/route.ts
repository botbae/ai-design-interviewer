import { NextRequest } from 'next/server';
import { getConfig } from '@/lib/config';
import { guardRequest, jsonError } from '@/lib/guard';
import { getLlmSettings, LlmConfigError, streamText } from '@/lib/llm';
import { mergeConsecutive } from '@/lib/phases';
import { buildInterviewSystemPrompt, withBootstrap } from '@/lib/prompts';
import { validateInterviewRequest } from '@/lib/validate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Streams the interviewer's next reply as plain text. */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError('Invalid JSON', 400);
  }

  const parsed = validateInterviewRequest(body);
  if (!parsed.ok) return jsonError(parsed.error, 400);

  const blocked = guardRequest(req, { usesModel: true });
  if (blocked) return blocked;

  let settings;
  try {
    settings = getLlmSettings();
  } catch (err) {
    if (err instanceof LlmConfigError) {
      console.error(err.message);
      return jsonError('The interviewer is not set up yet. The site owner needs to add an AI key.', 503);
    }
    throw err;
  }

  const cfg = getConfig();
  const { candidate, messages, phase } = parsed.value;
  const pieces = streamText(settings, {
    system: buildInterviewSystemPrompt(cfg, phase, candidate),
    messages: withBootstrap(mergeConsecutive(messages)),
    maxTokens: cfg.limits.maxOutputTokens,
  });

  // Pull the first piece before answering, so a bad key or provider outage
  // returns a clear error instead of an empty chat bubble.
  let first: IteratorResult<string>;
  try {
    first = await pieces.next();
  } catch (err) {
    console.error('model call failed:', err instanceof Error ? err.message : err);
    return jsonError('The interviewer could not respond right now. Please try again.', 502);
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        if (!first.done) controller.enqueue(encoder.encode(first.value));
        for await (const piece of pieces) controller.enqueue(encoder.encode(piece));
        controller.close();
      } catch (err) {
        console.error('model stream failed:', err instanceof Error ? err.message : err);
        controller.error(new Error('stream interrupted'));
      }
    },
    cancel() {
      void pieces.return(undefined);
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
