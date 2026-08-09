import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsString, MaxLength, Min } from 'class-validator';

export class AdminAdjustCreditsDto {
  @ApiProperty({ description: 'Credits amount (positive to add, negative to deduct)', example: 100 })
  @Type(() => Number)
  @IsNumber()
  amount!: number;

  @ApiProperty({ description: 'Reason for adjustment', example: 'Admin bonus' })
  @IsString()
  @MaxLength(500)
  reason!: string;
}
