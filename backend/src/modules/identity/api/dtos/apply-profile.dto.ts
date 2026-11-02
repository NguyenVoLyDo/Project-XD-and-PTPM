import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ApplyProfileDto {
  @IsNotEmpty({ message: 'Loại hồ sơ không được để trống' })
  @IsIn(['SELLER', 'SUPPLIER'], { message: 'Vai trò hồ sơ phải là SELLER hoặc SUPPLIER' })
  role!: 'SELLER' | 'SUPPLIER';

  @IsOptional()
  @IsString({ message: 'Tên pháp lý phải là chuỗi ký tự' })
  legalName?: string;

  @IsOptional()
  @IsString({ message: 'Tên hiển thị phải là chuỗi ký tự' })
  displayName?: string;

  @IsOptional()
  @IsString({ message: 'Thông tin tài khoản nhận thanh toán phải là chuỗi ký tự' })
  payoutAccountRef?: string;
}
