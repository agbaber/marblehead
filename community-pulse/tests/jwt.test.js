import { describe, it, expect } from 'vitest';
import { signJWT, verifyJWT, extractJWT } from '../worker/src/jwt.js';

const SECRET = 'test-secret';

describe('JWT pre_resident + auth_source', () => {
  it('round-trips a pre_resident payload', async () => {
    const token = await signJWT({
      pre_resident: true,
      fb_user_id: '123456',
      auth_source: 'self_serve',
    }, SECRET);
    const payload = await verifyJWT(token, SECRET);
    expect(payload.pre_resident).toBe(true);
    expect(payload.fb_user_id).toBe('123456');
    expect(payload.auth_source).toBe('self_serve');
  });

  it('round-trips an invite-vouched payload (legacy shape)', async () => {
    const token = await signJWT({
      sub: 'abc123',
      branch: 'xyz789',
    }, SECRET);
    const payload = await verifyJWT(token, SECRET);
    expect(payload.sub).toBe('abc123');
    expect(payload.branch).toBe('xyz789');
  });

  it('rejects tampered tokens', async () => {
    const token = await signJWT({ sub: 'abc' }, SECRET);
    const tampered = token.slice(0, -2) + 'XX';
    const payload = await verifyJWT(tampered, SECRET);
    expect(payload).toBeNull();
  });
});

describe('extractJWT', () => {
  it('reads the Authorization Bearer header', () => {
    const req = new Request('https://x/', {
      headers: { Authorization: 'Bearer abc.def.ghi' },
    });
    expect(extractJWT(req)).toBe('abc.def.ghi');
  });

  it('falls back to the verify_jwt cookie when no Authorization header', () => {
    const req = new Request('https://x/', {
      headers: { Cookie: 'verify_jwt=cookie.value.xyz; other=q' },
    });
    expect(extractJWT(req)).toBe('cookie.value.xyz');
  });

  it('prefers Authorization over cookie when both are present', () => {
    const req = new Request('https://x/', {
      headers: {
        Authorization: 'Bearer bearer.token.value',
        Cookie: 'verify_jwt=cookie.token.value',
      },
    });
    expect(extractJWT(req)).toBe('bearer.token.value');
  });

  it('returns null when neither header nor cookie carries a token', () => {
    const req = new Request('https://x/');
    expect(extractJWT(req)).toBeNull();
  });
});
