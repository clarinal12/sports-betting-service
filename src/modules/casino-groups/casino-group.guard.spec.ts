import {
  BadRequestException,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { CasinoGroupGuard } from './casino-group.guard';
import { CasinoGroupsService } from './casino-groups.service';
import { CASINO_GROUP_HEADER, CasinoGroupContext } from './casino-group.types';

function contextWithHeaders(
  headers: Record<string, string | string[] | undefined>,
): {
  ctx: ExecutionContext;
  request: { headers: typeof headers } & Record<string, unknown>;
} {
  const request = { headers } as { headers: typeof headers } & Record<
    string,
    unknown
  >;
  const ctx = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { ctx, request };
}

describe('CasinoGroupGuard', () => {
  const group: CasinoGroupContext = {
    id: 'grp_1',
    slug: 'acme',
    name: 'Acme Casino',
    defaultCurrency: 'USD',
    timezone: 'UTC',
  };

  let service: { resolveActiveBySlug: jest.Mock };
  let guard: CasinoGroupGuard;

  beforeEach(() => {
    service = { resolveActiveBySlug: jest.fn() };
    guard = new CasinoGroupGuard(service as unknown as CasinoGroupsService);
  });

  it('throws 400 when header is missing', async () => {
    const { ctx } = contextWithHeaders({});
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('throws 403 when group is unknown or inactive', async () => {
    service.resolveActiveBySlug.mockResolvedValue(null);
    const { ctx } = contextWithHeaders({ [CASINO_GROUP_HEADER]: 'nope' });
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('attaches the resolved group and allows the request', async () => {
    service.resolveActiveBySlug.mockResolvedValue(group);
    const { ctx, request } = contextWithHeaders({
      [CASINO_GROUP_HEADER]: 'acme',
    });

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(request.casinoGroup).toEqual(group);
  });
});
