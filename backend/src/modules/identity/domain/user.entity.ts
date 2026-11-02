import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  OneToOne,
} from 'typeorm';
import { UserRoleMembership } from './user-role-membership.entity.js';
import { SupplierProfile } from './supplier-profile.entity.js';
import { SellerProfile } from './seller-profile.entity.js';
import { UserStatus } from '../../../common/auth/current-actor.interface.js';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email!: string;

  @Column({ name: 'password_hash', type: 'text' })
  passwordHash!: string;

  @Column({ type: 'varchar', length: 32, default: 'ACTIVE' })
  status!: UserStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @OneToMany(() => UserRoleMembership, (membership) => membership.user, { cascade: true })
  roleMemberships!: UserRoleMembership[];

  @OneToOne(() => SupplierProfile, (profile) => profile.user)
  supplierProfile?: SupplierProfile;

  @OneToOne(() => SellerProfile, (profile) => profile.user)
  sellerProfile?: SellerProfile;
}
