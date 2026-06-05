import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class StaffLoginDto {
  @ApiProperty({ example: 'admin@acme.local' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'change-me-in-production' })
  @IsString()
  @MinLength(8)
  password!: string;
}

export class StaffRefreshDto {
  @ApiProperty()
  @IsString()
  @MinLength(20)
  refreshToken!: string;
}

export class StaffLogoutDto {
  @ApiProperty()
  @IsString()
  @MinLength(20)
  refreshToken!: string;
}
