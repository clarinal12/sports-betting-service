import { ApiProperty } from '@nestjs/swagger';

export class SportResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'soccer' })
  key: string;

  @ApiProperty({ example: 'Soccer' })
  name: string;

  @ApiProperty({ example: 'soccer' })
  slug: string;
}
