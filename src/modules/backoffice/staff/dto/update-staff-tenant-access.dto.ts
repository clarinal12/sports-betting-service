import { ApiProperty } from '@nestjs/swagger';
import { ArrayUnique, IsArray, IsString } from 'class-validator';

export class UpdateStaffTenantAccessDto {
  @ApiProperty({
    description: 'Casino group IDs the platform admin may access',
    type: [String],
  })
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  casinoGroupIds!: string[];
}
