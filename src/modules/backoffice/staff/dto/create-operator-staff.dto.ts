import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateOperatorStaffDto {
  @ApiProperty({ example: 'admin@betzone.merchant.local' })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ example: 'SecurePass123!', minLength: 8 })
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;
}
