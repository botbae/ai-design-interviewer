// Every setting a fork might want to change, read from environment variables.
// See .env.example for descriptions.

function num(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export function getConfig() {
  return {
    interviewerName: process.env.INTERVIEWER_NAME?.trim() || 'Riley',
    interviewerRole: process.env.INTERVIEWER_ROLE?.trim() || 'Product Designer',
    companyName: process.env.COMPANY_NAME?.trim() || 'an early-stage startup',

    /** Optional shared code. When set, every API call must send it. */
    accessCode: process.env.ACCESS_CODE?.trim() || '',

    limits: {
      /** Requests per visitor (IP) per minute, across all API routes. */
      perMinute: num('RATE_LIMIT_PER_MINUTE', 20),
      /** Total model calls per server per day. A rough spend guard. 0 = unlimited. */
      dailyModelCalls: num('DAILY_MODEL_CALL_LIMIT', 300),
      /** Longest reply the model may write, in tokens. */
      maxOutputTokens: num('MAX_OUTPUT_TOKENS', 600),
      /** Interview length in minutes before it jumps to the wrap-up. */
      maxMinutes: num('MAX_INTERVIEW_MINUTES', 30),
    },
  };
}

export type AppConfig = ReturnType<typeof getConfig>;

/** Size caps for anything a visitor can send. */
export const LIMITS = {
  uploadBytes: 5 * 1024 * 1024,
  resumeChars: 20_000,
  jdChars: 12_000,
  linkChars: 300,
  messageChars: 4_000,
  messages: 60,
  totalChars: 120_000,
} as const;
