import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { RoleType } from '../../../../common/auth/current-actor.interface.js';

export class RegisterDto {
  @IsEmail({}, { message: 'Email không đúng định dạng' })
  @IsNotEmpty({ message: 'Email không được để trống' })
  email!: string;

  @IsString({ message: 'Mật khẩu phải là chuỗi ký tự' })
  @MinLength(8, { message: 'Mật khẩu phải có ít nhất 8 ký tự' })
  password!: string;

  @IsOptional()
  @IsString()
  role?: RoleType;
}
