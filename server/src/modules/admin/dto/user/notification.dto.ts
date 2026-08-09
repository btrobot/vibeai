import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MaxLength, IsEnum, IsOptional } from 'class-validator';

export enum NotificationType {
  IN_APP = 'in_app',
  EMAIL = 'email',
  BOTH = 'both',
}

export class AdminSendNotificationDto {
  @ApiProperty({ description: '通知类型', enum: NotificationType, default: NotificationType.IN_APP })
  @IsEnum(NotificationType)
  @IsOptional()
  type?: NotificationType = NotificationType.IN_APP;

  @ApiProperty({ description: '通知标题', example: '系统通知' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @ApiProperty({ description: '通知内容', example: '您的账户已通过验证' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  content!: string;

  @ApiProperty({ description: '通知链接（可选）', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  link?: string;

  @ApiProperty({ description: '通知图标（可选）', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  icon?: string;
}

export class AdminBroadcastNotificationDto extends AdminSendNotificationDto {
  @ApiProperty({ description: '目标角色', enum: ['user', 'admin', 'all'], default: 'all' })
  @IsEnum(['user', 'admin', 'all'])
  @IsOptional()
  targetRole?: 'user' | 'admin' | 'all' = 'all';
}
