import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class AdminUpdateUserDto {
  @ApiPropertyOptional({ description: 'User display name' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ description: 'User avatar URL' })
  @IsOptional()
  @IsString()
  avatar?: string;

  @ApiPropertyOptional({ enum: ['user', 'admin'] })
  @IsOptional()
  @IsIn(['user', 'admin'])
  role?: 'user' | 'admin';

  @ApiPropertyOptional({ description: 'Account active status' })
  @IsOptional()
  @IsIn(['true', 'false'])
  isActive?: string;
}
