import { describe, expect, it } from 'vitest';
import { LIMITS } from '@/lib/config';
import { validateInterviewRequest, validateReportRequest } from '@/lib/validate';

const candidate = { resume: 'Jordan, product designer with 5 years of experience.' };

describe('validateInterviewRequest', () => {
  it('accepts a normal request and fills defaults', () => {
    const r = validateInterviewRequest({ candidate, messages: [] });
    expect(r.ok && r.value.phase).toBe('orientation');
    expect(r.ok && r.value.candidate.jd).toBe('');
  });

  it.each([
    ['null body', null],
    ['no candidate', { messages: [] }],
    ['empty resume', { candidate: { resume: '  ' } }],
    ['messages not a list', { candidate, messages: 'abc' }],
    ['bad role', { candidate, messages: [{ role: 'system', content: 'x' }] }],
    ['non-text content', { candidate, messages: [{ role: 'user', content: 5 }] }],
    ['unknown step', { candidate, phase: 'constructor' }],
    ['huge resume', { candidate: { resume: 'x'.repeat(LIMITS.resumeChars + 1) } }],
    ['huge job description', { candidate: { ...candidate, jd: 'x'.repeat(LIMITS.jdChars + 1) } }],
    ['huge message', { candidate, messages: [{ role: 'user', content: 'x'.repeat(LIMITS.messageChars + 1) }] }],
    ['too many messages', { candidate, messages: Array.from({ length: LIMITS.messages + 1 }, () => ({ role: 'user', content: 'hi' })) }],
  ])('rejects %s', (_label, body) => {
    expect(validateInterviewRequest(body).ok).toBe(false);
  });

  it('drops unexpected fields from messages', () => {
    const r = validateInterviewRequest({ candidate, messages: [{ role: 'user', content: 'hi', extra: 'x' }] });
    expect(r.ok && r.value.messages[0]).toEqual({ role: 'user', content: 'hi' });
  });
});

describe('validateReportRequest', () => {
  it('needs at least one candidate answer', () => {
    expect(validateReportRequest({ candidate, messages: [{ role: 'assistant', content: 'Hi' }] }).ok).toBe(false);
    expect(validateReportRequest({ candidate, messages: [{ role: 'user', content: 'Hi' }] }).ok).toBe(true);
  });
});
