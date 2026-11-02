import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class AdminProfileDecisionDto {
  @IsNotEmpty({ message: 'Vai trò hồ sơ không được để trống' })
  @IsIn(['SUPPLIER', 'SELLER'], { message: 'Vai trò phải là SUPPLIER hoặc SELLER' })
  role!: 'SUPPLIER' | 'SELLER';

  @IsNotEmpty({ message: 'Quyết định không được để trống' })
  @IsIn(['APPROVED', 'REJECTED'], { message: 'Quyết định phải là APPROVED hoặc REJECTED' })
  decision!: 'APPROVED' | 'REJECTED';

  @IsOptional()
  @IsString({ message: 'Mã lý do phải là chuỗi ký tự' })
  reasonCode?: string;
}
