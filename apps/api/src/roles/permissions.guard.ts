import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Permission } from '@la-chat/shared-types';
import { PERMISSIONS_KEY } from './permissions.decorator';
import { RolesService } from './roles.service';
import { AuthedUser } from '../auth/auth.types';

@Injectable()
export class PermissionsGuard implements CanActivate {
  private readonly logger = new Logger('PermissionsGuard');

  constructor(
    private reflector: Reflector,
    private rolesService: RolesService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) {
      return true; // no permission required
    }

    const req = context.switchToHttp().getRequest<{ user?: AuthedUser }>();
    const user = req.user;
    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    const userPerms = this.rolesService.getPermissionsForRoles(user.roles);
    const hasAny = required.some((p) => userPerms.has(p));
    if (!hasAny) {
      this.logger.warn(
        `Denied: user ${user.id} (${user.roles.join(',')}) attempted action requiring [${required.join(',')}]`,
      );
      throw new ForbiddenException('You do not have permission to perform this action');
    }
    return true;
  }
}
