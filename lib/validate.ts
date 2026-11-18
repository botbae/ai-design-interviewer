// Checks every request before anything reaches the model.
// Anything that fails returns a short, safe error message.

import { LIMITS } from './config';
import { isPhase, type ChatMessage, type Phase } from './phases';

export interface Candidate {
  resume: string;
  jd: string;
  github: string;
  linkedin: string;
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function optionalString(v: unknown, max: number, field: string): Result<string> {
  if (v === undefined || v === null || v === '') return { ok: true, value: '' };
  if (typeof v !== 'string') return { ok: false, error: `${field} must be text` };
  if (v.length > max) return { ok: false, error: `${field} is too long (max ${max} characters)` };
  return { ok: true, value: v.trim() };
}

export function validateCandidate(v: unknown): Result<Candidate> {
  if (!isRecord(v)) return { ok: false, error: 'Missing candidate details' };
  if (typeof v.resume !== 'string' || v.resume.trim().length === 0) {
    return { ok: false, error: 'Missing resume text' };
  }
  if (v.resume.length > LIMITS.resumeChars) {
    return { ok: false, error: `Resume is too long (max ${LIMITS.resumeChars} characters)` };
  }
  const jd = optionalString(v.jd, LIMITS.jdChars, 'Job description');
  if (!jd.ok) return jd;
  const github = optionalString(v.github, LIMITS.linkChars, 'GitHub link');
  if (!github.ok) return github;
  const linkedin = optionalString(v.linkedin, LIMITS.linkChars, 'LinkedIn link');
  if (!linkedin.ok) return linkedin;
  return {
    ok: true,
    value: { resume: v.resume.trim(), jd: jd.value, github: github.value, linkedin: linkedin.value },
  };
}

export function validateMessages(v: unknown): Result<ChatMessage[]> {
  if (v === undefined || v === null) return { ok: true, value: [] };
  if (!Array.isArray(v)) return { ok: false, error: 'messages must be a list' };
  if (v.length > LIMITS.messages) return { ok: false, error: 'Conversation is too long' };
  let total = 0;
  const out: ChatMessage[] = [];
  for (const m of v) {
    if (!isRecord(m)) return { ok: false, error: 'Invalid message' };
    if (m.role !== 'user' && m.role !== 'assistant') return { ok: false, error: 'Invalid message role' };
    if (typeof m.content !== 'string' || m.content.trim().length === 0) {
      return { ok: false, error: 'Invalid message content' };
    }
    if (m.content.length > LIMITS.messageChars) {
      return { ok: false, error: `Message is too long (max ${LIMITS.messageChars} characters)` };
    }
    total += m.content.length;
    out.push({ role: m.role, content: m.content });
  }
  if (total > LIMITS.totalChars) return { ok: false, error: 'Conversation is too long' };
  return { ok: true, value: out };
}

export interface InterviewRequest {
  candidate: Candidate;
  messages: ChatMessage[];
  phase: Phase;
}

export function validateInterviewRequest(body: unknown): Result<InterviewRequest> {
  if (!isRecord(body)) return { ok: false, error: 'Invalid request body' };
  const candidate = validateCandidate(body.candidate);
  if (!candidate.ok) return candidate;
  const messages = validateMessages(body.messages);
  if (!messages.ok) return messages;
  const phase = body.phase ?? 'orientation';
  if (!isPhase(phase)) return { ok: false, error: 'Unknown interview step' };
  return { ok: true, value: { candidate: candidate.value, messages: messages.value, phase } };
}

export interface ReportRequest {
  candidate: Candidate;
  messages: ChatMessage[];
}

export function validateReportRequest(body: unknown): Result<ReportRequest> {
  if (!isRecord(body)) return { ok: false, error: 'Invalid request body' };
  const candidate = validateCandidate(body.candidate);
  if (!candidate.ok) return candidate;
  const messages = validateMessages(body.messages);
  if (!messages.ok) return messages;
  if (!messages.value.some(m => m.role === 'user')) {
    return { ok: false, error: 'There are no answers to review yet' };
  }
  return { ok: true, value: { candidate: candidate.value, messages: messages.value } };
}
