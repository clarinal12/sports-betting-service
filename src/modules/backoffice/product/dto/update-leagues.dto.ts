import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsString,
  ValidateNested,
} from 'class-validator';

export class LeagueOfferingDto {
  @ApiProperty()
  @IsString()
  leagueId!: string;

  @ApiProperty()
  @IsBoolean()
  enabled!: boolean;
}

export class UpdateLeaguesDto {
  @ApiProperty({ type: [LeagueOfferingDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => LeagueOfferingDto)
  leagues!: LeagueOfferingDto[];
}
