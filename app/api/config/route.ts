import { NextResponse } from 'next/server';
import { getConfig } from '@/lib/config';

export const dynamic = 'force-dynamic';

/** Public, non-secret settings the browser needs. Never put keys here. */
export function GET() {
  const cfg = getConfig();
  return NextResponse.json({
    interviewerName: cfg.interviewerName,
    interviewerRole: cfg.interviewerRole,
    companyName: cfg.companyName,
    accessCodeRequired: Boolean(cfg.accessCode),
    maxMinutes: cfg.limits.maxMinutes,
  });
}
