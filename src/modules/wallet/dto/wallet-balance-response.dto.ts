import { ApiProperty } from '@nestjs/swagger';

export class WalletBalanceResponseDto {
  @ApiProperty({ example: '1000.00' })
  balance!: string;

  @ApiProperty({ example: 'USD' })
  currency!: string;
}
