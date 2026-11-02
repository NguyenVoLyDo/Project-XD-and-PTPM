import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class AdminUserStatusDto {
  @IsIn(['ACTIVE', 'LOCKED'], {
    message: 'Trạng thái người dùng phải là ACTIVE hoặc LOCKED',
  })
  @IsNotEmpty({ message: 'Trạng thái không được để trống' })
  status!: 'ACTIVE' | 'LOCKED';

  @IsString({ message: 'Lý do phải là chuỗi ký tự' })
  @IsOptional()
  reason?: string;
}
