import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { User } from './user.entity.js';
import { RoleType } from '../../../common/auth/current-actor.interface.js';

@Entity('user_role_memberships')
@Unique(['userId', 'role'])
export class UserRoleMembership {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar', length: 32 })
  role!: RoleType;

  @Column({ type: 'varchar', length: 32, default: 'ACTIVE' })
  status!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @ManyToOne(() => User, (user) => user.roleMemberships, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;
}
