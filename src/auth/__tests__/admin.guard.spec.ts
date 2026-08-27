import { UnauthorizedException } from '@nestjs/common';
import { AdminGuard } from '../admin.guard';

function mockContext(cookies: Record<string, string> = {}) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ cookies }),
    }),
  };
}

describe('AdminGuard', () => {
  let guard: AdminGuard;

  beforeEach(() => {
    guard = new AdminGuard();
    process.env.ADMIN_SESSION_SECRET = 'valid-session';
  });

  afterEach(() => {
    delete process.env.ADMIN_SESSION_SECRET;
  });

  it('rejects requests with no admin_session cookie', () => {
    const ctx = mockContext({});
    expect(() => guard.canActivate(ctx as never)).toThrow(
      UnauthorizedException,
    );
  });

  it('rejects requests with wrong session token', () => {
    const ctx = mockContext({ admin_session: 'wrong-token' });
    expect(() => guard.canActivate(ctx as never)).toThrow(
      UnauthorizedException,
    );
  });

  it('accepts valid session token', () => {
    const ctx = mockContext({ admin_session: 'valid-session' });
    expect(guard.canActivate(ctx as never)).toBe(true);
  });
});
