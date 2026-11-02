import { SetMetadata } from '@nestjs/common';
import { RoleType } from './current-actor.interface.js';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: RoleType[]) => SetMetadata(ROLES_KEY, roles);
