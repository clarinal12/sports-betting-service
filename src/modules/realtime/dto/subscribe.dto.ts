import { ArrayMaxSize, IsArray, IsOptional, IsString } from 'class-validator';

export class SubscribeDto {
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(50)
  eventIds!: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(50)
  marketIds?: string[];
}
