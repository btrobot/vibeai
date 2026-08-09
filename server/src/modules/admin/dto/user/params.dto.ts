import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID } from 'class-validator';

export class AdminUserIdParamDto {
  @ApiProperty({ description: 'User ID' })
  @IsString()
  @IsUUID()
  id!: string;
}
