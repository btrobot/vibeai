import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsBoolean, Min, Max } from 'class-validator';

export class AdminExportQueryDto {
  @ApiPropertyOptional({ description: 'Search keyword' })
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ enum: ['user', 'admin'] })
  @IsOptional()
  role?: 'user' | 'admin';

  @ApiPropertyOptional({ enum: ['active', 'banned'] })
  @IsOptional()
  status?: 'active' | 'banned';

  @ApiPropertyOptional({ description: 'Maximum rows to export', default: 10000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100000)
  limit?: number = 10000;

  @ApiPropertyOptional({ description: 'Include UTF-8 BOM for Excel', default: true })
  @IsOptional()
  @IsBoolean()
  includeBOM?: boolean = true;
}

export class PaginatedExportDto extends AdminExportQueryDto {
  @ApiPropertyOptional({ description: 'Page number for batch export' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;
}
