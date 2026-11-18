// Shared checks that run at the start of every API route.

import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { getConfig } from './config';
import { clientKey, dailyModelLimiter, visitorLimiter } from './rate-limit';

export function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

function sameCode(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Returns an error response if the request should be refused, otherwise null. */
export function guardRequest(req: Request, opts: { usesModel: boolean }): NextResponse | null {
  const cfg = getConfig();

  if (cfg.accessCode) {
    const sent = req.headers.get('x-access-code') ?? '';
    if (!sameCode(sent, cfg.accessCode)) return jsonError('Access code required', 401);
  }

  if (!visitorLimiter(cfg.limits.perMinute).take(clientKey(req.headers))) {
    return jsonError('Too many requests. Please wait a minute and try again.', 429);
  }

  if (opts.usesModel && !dailyModelLimiter(cfg.limits.dailyModelCalls).take('global')) {
    return jsonError('This demo has reached its daily limit. Please try again tomorrow.', 429);
  }

  return null;
}
