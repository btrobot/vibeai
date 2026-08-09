import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../shared/pagination.dto';

export class AdminUserQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Search by email or name' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: ['user', 'admin'], description: 'Filter by role' })
  @IsOptional()
  @IsIn(['user', 'admin'])
  role?: 'user' | 'admin';

  @ApiPropertyOptional({ enum: ['active', 'banned'], description: 'Filter by status' })
  @IsOptional()
  @IsIn(['active', 'banned'])
  status?: 'active' | 'banned';

  @ApiPropertyOptional({ description: 'Filter by email verification status' })
  @IsOptional()
  @IsIn(['true', 'false'])
  isEmailVerified?: string;
}

export class AdminExportUsersQueryDto {
  @ApiPropertyOptional({ description: 'Search by email or name' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: ['user', 'admin'] })
  @IsOptional()
  @IsIn(['user', 'admin'])
  role?: 'user' | 'admin';

  @ApiPropertyOptional({ enum: ['active', 'banned'] })
  @IsOptional()
  @IsIn(['active', 'banned'])
  status?: 'active' | 'banned';
}
