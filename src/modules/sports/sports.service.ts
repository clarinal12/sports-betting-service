import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { SportResponseDto } from './dto/sport-response.dto';

@Injectable()
export class SportsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Active sports that have at least one enabled league for this tenant.
   */
  async listForGroup(casinoGroupId: string): Promise<SportResponseDto[]> {
    const sports = await this.prisma.sport.findMany({
      where: {
        active: true,
        leagues: {
          some: {
            active: true,
            groups: { some: { casinoGroupId, enabled: true } },
          },
        },
      },
      orderBy: { name: 'asc' },
      select: { id: true, key: true, name: true, slug: true },
    });
    return sports;
  }
}
