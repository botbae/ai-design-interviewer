import { NextRequest, NextResponse } from 'next/server';
import { getConfig } from '@/lib/config';
import { guardRequest, jsonError } from '@/lib/guard';
import { completeText, getLlmSettings, LlmConfigError } from '@/lib/llm';
import { buildReportPrompt, transcriptForReport } from '@/lib/prompts';
import { extractJson, normalizeReport } from '@/lib/report';
import { validateReportRequest } from '@/lib/validate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Reads the finished transcript and returns a scored summary. */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError('Invalid JSON', 400);
  }

  const parsed = validateReportRequest(body);
  if (!parsed.ok) return jsonError(parsed.error, 400);

  const blocked = guardRequest(req, { usesModel: true });
  if (blocked) return blocked;

  let settings;
  try {
    settings = getLlmSettings();
  } catch (err) {
    if (err instanceof LlmConfigError) {
      console.error(err.message);
      return jsonError('The report is not available because no AI key is set up.', 503);
    }
    throw err;
  }

  const cfg = getConfig();
  const { candidate, messages } = parsed.value;

  try {
    const text = await completeText(settings, {
      system: buildReportPrompt(cfg, candidate),
      messages: [{ role: 'user', content: transcriptForReport(messages, cfg.interviewerName) }],
      maxTokens: 2000,
    });
    return NextResponse.json({ report: normalizeReport(extractJson(text)) });
  } catch (err) {
    console.error('report failed:', err instanceof Error ? err.message : err);
    return jsonError('We could not create the report. Please try again.', 502);
  }
}
