import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../shared/pagination.dto';

export class AdminGalleryQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: ['published', 'unpublished'], description: 'Filter by publication status' })
  @IsOptional()
  @IsIn(['published', 'unpublished'])
  status?: 'published' | 'unpublished';

  @ApiPropertyOptional({ description: 'Filter by work type' })
  @IsOptional()
  @IsString()
  type?: string;
}

export class AdminExportGalleryQueryDto {
  @ApiPropertyOptional({ enum: ['published', 'unpublished'] })
  @IsOptional()
  @IsIn(['published', 'unpublished'])
  status?: 'published' | 'unpublished';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  type?: string;
}
