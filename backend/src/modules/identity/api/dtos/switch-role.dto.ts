import { IsIn, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { RoleType } from '../../../../common/auth/current-actor.interface.js';

export class SwitchActiveRoleDto {
  @IsNotEmpty({ message: 'Vai trò không được để trống' })
  @IsIn(['CUSTOMER', 'SELLER', 'SUPPLIER', 'ADMIN'], { message: 'Vai trò không hợp lệ' })
  role!: RoleType;

  @IsOptional()
  @IsUUID('4', { message: 'Profile ID phải là UUID v4' })
  profileId?: string;
}
