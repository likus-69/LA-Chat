import { SetMetadata } from '@nestjs/common';
import { Permission } from '@la-chat/shared-types';

export const PERMISSIONS_KEY = 'permissions';

/**
 * Decorate a route handler with the permissions required to call it.
 * The PermissionsGuard will check that the authenticated user holds
 * at least one of the listed permissions.
 *
 * @example
 *   @Permissions(Permission.USER_SUSPEND)
 *   @Post(':id/suspend')
 *   suspendUser(@Param('id') id: string) { ... }
 */
export const Permissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
