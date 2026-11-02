import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class AdminDisputeDecisionDto {
  @IsIn(['APPROVED', 'REJECTED'], {
    message: 'Quyết định khiếu nại phải là APPROVED hoặc REJECTED',
  })
  @IsNotEmpty({ message: 'Quyết định không được để trống' })
  decision!: 'APPROVED' | 'REJECTED';

  @IsString({ message: 'Mã lý do phải là chuỗi ký tự' })
  @IsOptional()
  reasonCode?: string;
}
