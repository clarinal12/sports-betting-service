import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CasinoGroupsService } from '../casino-groups/casino-groups.service';
import { CASINO_GROUP_HEADER } from '../casino-groups/casino-group.types';
import { PlayerAuthGuard } from './player-auth.guard';
import { SessionService } from './session.service';
import { UserContext } from './user-context.types';

const group = {
  id: 'grp_1',
  slug: 'acme',
  name: 'Acme',
  defaultCurrency: 'USD',
  timezone: 'UTC',
};
const user: UserContext = {
  userId: 'u1',
  username: 'alice',
  casinoGroupId: 'grp_1',
  currency: 'USD',
};

function contextWith(headers: Record<string, string>): {
  ctx: ExecutionContext;
  request: { headers: Record<string, string> } & Record<string, unknown>;
} {
  const request = { headers } as { headers: Record<string, string> } & Record<
    string,
    unknown
  >;
  const ctx = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { ctx, request };
}

function makeGuard(opts: {
  sessionUser?: UserContext | Error;
  resolveById?: typeof group | null;
  resolveBySlug?: typeof group | null;
  fallback?: boolean;
}): PlayerAuthGuard {
  const sessions = {
    verify: jest.fn(() => {
      if (opts.sessionUser instanceof Error) throw opts.sessionUser;
      return opts.sessionUser;
    }),
  } as unknown as SessionService;
  const casinoGroups = {
    resolveActiveById: jest.fn().mockResolvedValue(opts.resolveById ?? null),
    resolveActiveBySlug: jest
      .fn()
      .mockResolvedValue(opts.resolveBySlug ?? null),
  } as unknown as CasinoGroupsService;
  const config = {
    get: () => opts.fallback ?? false,
  } as unknown as ConfigService;
  return new PlayerAuthGuard(sessions, casinoGroups, config);
}

describe('PlayerAuthGuard', () => {
  it('authorizes a valid Bearer token and attaches user + group', async () => {
    const guard = makeGuard({ sessionUser: user, resolveById: group });
    const { ctx, request } = contextWith({ authorization: 'Bearer good' });

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(request.user).toEqual(user);
    expect(request.casinoGroup).toEqual(group);
  });

  it('403s when the token group is unknown/inactive', async () => {
    const guard = makeGuard({ sessionUser: user, resolveById: null });
    const { ctx } = contextWith({ authorization: 'Bearer good' });
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('falls back to the header in dev and attaches group only', async () => {
    const guard = makeGuard({ resolveBySlug: group, fallback: true });
    const { ctx, request } = contextWith({ [CASINO_GROUP_HEADER]: 'acme' });

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(request.casinoGroup).toEqual(group);
    expect(request.user).toBeUndefined();
  });

  it('401s with no token and fallback disabled', async () => {
    const guard = makeGuard({ fallback: false });
    const { ctx } = contextWith({ [CASINO_GROUP_HEADER]: 'acme' });
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('401s on an invalid Bearer token', async () => {
    const guard = makeGuard({
      sessionUser: new UnauthorizedException('bad'),
      fallback: true,
    });
    const { ctx } = contextWith({ authorization: 'Bearer bad' });
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
