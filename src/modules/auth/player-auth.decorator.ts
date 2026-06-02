import { applyDecorators, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader } from '@nestjs/swagger';
import { CASINO_GROUP_HEADER } from '../casino-groups/casino-group.types';
import { PlayerAuthGuard } from './player-auth.guard';

/**
 * Marks a player route as protected: requires a Bearer session token, or (in
 * dev, when AUTH_ALLOW_HEADER_FALLBACK is on) the X-Casino-Group slug header.
 */
export function PlayerAuth(): ReturnType<typeof applyDecorators> {
  return applyDecorators(
    UseGuards(PlayerAuthGuard),
    ApiBearerAuth(),
    ApiHeader({
      name: CASINO_GROUP_HEADER,
      required: false,
      description: 'Casino group slug (dev fallback when no Bearer token)',
    }),
  );
}
