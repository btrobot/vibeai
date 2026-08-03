import { IsString, IsEmail, IsOptional, MinLength, MaxLength, Matches } from 'class-validator';

export class RegisterDto {
  @IsEmail({}, { message: '请输入有效的邮箱地址' })
  email!: string;

  @IsString()
  @MinLength(8, { message: '密码至少8位' })
  @Matches(/[A-Za-z]/, { message: '密码必须包含字母' })
  @Matches(/[0-9]/, { message: '密码必须包含数字' })
  password!: string;

  @IsString()
  @MinLength(2, { message: '昵称至少2位' })
  @MaxLength(50, { message: '昵称最多50位' })
  name!: string;
}

export class LoginDto {
  @IsEmail({}, { message: '请输入有效的邮箱地址' })
  email!: string;

  @IsString()
  @MinLength(1, { message: '请输入密码' })
  password!: string;
}

export class RefreshTokenDto {
  @IsString()
  @MinLength(1)
  refreshToken!: string;
}

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(2, { message: '昵称至少2位' })
  @MaxLength(50, { message: '昵称最多50位' })
  name?: string;

  @IsOptional()
  @IsString()
  avatar?: string;
}

export class ChangePasswordDto {
  @IsString()
  @MinLength(1, { message: '请输入当前密码' })
  currentPassword!: string;

  @IsString()
  @MinLength(8, { message: '新密码至少8位' })
  @Matches(/[A-Za-z]/, { message: '新密码必须包含字母' })
  @Matches(/[0-9]/, { message: '新密码必须包含数字' })
  newPassword!: string;
}