import { describe, expect, it } from 'vitest';
import { clientKey, createRateLimiter } from '@/lib/rate-limit';

describe('createRateLimiter', () => {
  it('allows up to the limit, then blocks until the window resets', () => {
    let now = 0;
    const rl = createRateLimiter(2, 1000, () => now);
    expect(rl.take('a')).toBe(true);
    expect(rl.take('a')).toBe(true);
    expect(rl.take('a')).toBe(false);
    expect(rl.take('b')).toBe(true);
    now = 1001;
    expect(rl.take('a')).toBe(true);
  });

  it('treats a limit of 0 as unlimited', () => {
    const rl = createRateLimiter(0, 1000);
    for (let i = 0; i < 100; i++) expect(rl.take('x')).toBe(true);
  });
});

describe('clientKey', () => {
  it('uses the first forwarded address', () => {
    expect(clientKey(new Headers({ 'x-forwarded-for': '1.2.3.4, 10.0.0.1' }))).toBe('1.2.3.4');
    expect(clientKey(new Headers())).toBe('local');
  });
});
