import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEmail, IsIn, IsNumber, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class AdminCreateUserDto {
  @ApiProperty({ description: 'User email' })
  @IsEmail({}, { message: 'Invalid email format' })
  @MaxLength(200)
  email!: string;

  @ApiProperty({ description: 'User display name' })
  @IsString()
  @MinLength(1, { message: 'Name is required' })
  @MaxLength(100)
  name!: string;

  @ApiProperty({ description: 'User password' })
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  @MaxLength(100)
  password!: string;

  @ApiProperty({ enum: ['user', 'admin'], default: 'user' })
  @IsIn(['user', 'admin'])
  @IsOptional()
  role?: 'user' | 'admin' = 'user';

  @ApiPropertyOptional({ description: 'Initial credits balance', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  credits?: number = 0;
}
