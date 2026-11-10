import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ROLE_PERMISSIONS, RoleName, Permission } from '@la-chat/shared-types';

/**
 * Reads the canonical ROLE_PERMISSIONS map from @la-chat/shared-types and
 * seeds the database `roles`, `permissions`, `role_permissions` tables.
 * The in-memory cache (`rolePerms`) is the source of truth for the
 * `PermissionsGuard` at runtime; the DB tables are seeded so that
 * audit/display tools can introspect the matrix.
 */
@Injectable()
export class RolesService implements OnModuleInit {
  private readonly logger = new Logger('RolesService');
  private rolePerms: Map<RoleName, Set<Permission>> = new Map();

  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    // Build the in-memory cache.
    for (const [role, perms] of Object.entries(ROLE_PERMISSIONS)) {
      this.rolePerms.set(role as RoleName, new Set(perms));
    }

    // Seed the DB (idempotent).
    await this.seedRolesAndPermissions();
    this.logger.log(`Loaded ${this.rolePerms.size} roles with permissions`);
  }

  private async seedRolesAndPermissions() {
    const allPerms = new Set<Permission>();
    for (const perms of Object.values(ROLE_PERMISSIONS)) {
      for (const p of perms) allPerms.add(p);
    }

    // Upsert permissions
    for (const code of allPerms) {
      await this.prisma.permission.upsert({
        where: { code },
        update: {},
        create: { code },
      });
    }

    // Upsert roles + role_permissions
    for (const [roleName, perms] of Object.entries(ROLE_PERMISSIONS) as [RoleName, Permission[]][]) {
      const role = await this.prisma.role.upsert({
        where: { name: roleName },
        update: {},
        create: { name: roleName, description: `Role: ${roleName}` },
        include: { permissions: true },
      });

      const desiredPermIds = await this.prisma.permission.findMany({
        where: { code: { in: perms } },
        select: { id: true, code: true },
      });

      const existingCodes = new Set(role.permissions.map((rp) => rp.permissionId));
      // Note: we stored permissionId not code, so re-fetch by code below.

      const rolePerms = await this.prisma.rolePermission.findMany({
        where: { roleId: role.id },
        include: { permission: true },
      });
      const existingPermCodes = new Set(rolePerms.map((rp) => rp.permission.code));

      const toAdd = desiredPermIds.filter((p) => !existingPermCodes.has(p.code));
      for (const p of toAdd) {
        await this.prisma.rolePermission.create({
          data: { roleId: role.id, permissionId: p.id },
        });
      }
      // Deletions are intentionally not done here — revoking a permission
      // is a deliberate, audited action, not an automatic side-effect of a
      // deploy.
    }
  }

  /** Returns the set of permissions granted to a role. */
  getPermissionsForRole(role: RoleName): Set<Permission> {
    return this.rolePerms.get(role) ?? new Set();
  }

  /** Returns the union of permissions for all roles the user holds. */
  getPermissionsForRoles(roles: RoleName[]): Set<Permission> {
    const result = new Set<Permission>();
    for (const r of roles) {
      const perms = this.rolePerms.get(r);
      if (perms) for (const p of perms) result.add(p);
    }
    return result;
  }

  /** True if any of the user's roles grants this permission. */
  hasPermission(roles: RoleName[], permission: Permission): boolean {
    return this.getPermissionsForRoles(roles).has(permission);
  }
}
