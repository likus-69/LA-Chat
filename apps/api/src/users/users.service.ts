import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AccountStatus, UserProfileDto, RoleName } from '@la-chat/shared-types';
import type { User, UserRole, Role, StudentProfile, StaffProfile } from '@prisma/client';

export type UserWithRoles = User & { roles: (UserRole & { role: Role })[] };

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  /**
   * Look up a user by email, phone, admission number, or staff number.
   * Used by the auth service at login time.
   */
  async findByIdentifier(identifier: string): Promise<UserWithRoles | null> {
    const byEmail = await this.prisma.user.findUnique({
      where: { email: identifier.toLowerCase() },
      include: { roles: { include: { role: true } } },
    });
    if (byEmail) return byEmail;

    const byPhone = await this.prisma.user.findUnique({
      where: { phone: identifier },
      include: { roles: { include: { role: true } } },
    });
    if (byPhone) return byPhone;

    const student = await this.prisma.studentProfile.findUnique({
      where: { admissionNo: identifier },
      include: { user: { include: { roles: { include: { role: true } } } } },
    });
    if (student) return student.user;

    const staff = await this.prisma.staffProfile.findUnique({
      where: { staffNo: identifier },
      include: { user: { include: { roles: { include: { role: true } } } } },
    });
    if (staff) return staff.user;

    return null;
  }

  /** Build the public profile DTO for a user. */
  async getProfile(userId: string): Promise<UserProfileDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: { include: { role: true } },
        studentProfile: { include: { class: true, stream: true } },
        staffProfile: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');

    const roles = user.roles.map((ur) => ur.role.name) as RoleName[];
    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      roles,
      status: user.status as AccountStatus,
      createdAt: user.createdAt.toISOString(),
      admissionNo: user.studentProfile?.admissionNo ?? null,
      staffNo: user.staffProfile?.staffNo ?? null,
      department: user.staffProfile?.department ?? null,
      className: user.studentProfile?.class?.name ?? null,
      streamName: user.studentProfile?.stream?.name ?? null,
    };
  }

  /** List users with optional role filter — for the admin dashboard. */
  async list(opts: {
    role?: RoleName;
    status?: AccountStatus;
    page?: number;
    pageSize?: number;
  } = {}): Promise<{ items: UserProfileDto[]; total: number; page: number; pageSize: number }> {
    const page = Math.max(1, opts.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 20));

    const where = {
      deletedAt: null,
      ...(opts.status ? { status: opts.status } : {}),
      ...(opts.role
        ? { roles: { some: { role: { name: opts.role } } } }
        : {}),
    };

    const [total, rows] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        include: {
          roles: { include: { role: true } },
          studentProfile: { include: { class: true, stream: true } },
          staffProfile: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const items = rows.map((u) => ({
      id: u.id,
      fullName: u.fullName,
      email: u.email,
      phone: u.phone,
      roles: u.roles.map((ur) => ur.role.name) as RoleName[],
      status: u.status as AccountStatus,
      createdAt: u.createdAt.toISOString(),
      admissionNo: u.studentProfile?.admissionNo ?? null,
      staffNo: u.staffProfile?.staffNo ?? null,
      department: u.staffProfile?.department ?? null,
      className: u.studentProfile?.class?.name ?? null,
      streamName: u.studentProfile?.stream?.name ?? null,
    }));

    return { items, total, page, pageSize };
  }

  async approve(userId: string, approverId: string): Promise<UserProfileDto> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { status: AccountStatus.ACTIVE },
    });
    await this.prisma.auditLog.create({
      data: {
        actorId: approverId,
        action: 'user.approve',
        targetType: 'user',
        targetId: userId,
      },
    });
    return this.getProfile(userId);
  }

  async suspend(userId: string, reason: string, actorId: string): Promise<UserProfileDto> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { status: AccountStatus.SUSPENDED },
    });
    await this.prisma.auditLog.create({
      data: {
        actorId,
        action: 'user.suspend',
        targetType: 'user',
        targetId: userId,
      },
    });
    // Revoke all sessions
    await this.prisma.userSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return this.getProfile(userId);
  }

  async restore(userId: string, actorId: string): Promise<UserProfileDto> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { status: AccountStatus.ACTIVE },
    });
    await this.prisma.auditLog.create({
      data: {
        actorId,
        action: 'user.restore',
        targetType: 'user',
        targetId: userId,
      },
    });
    return this.getProfile(userId);
  }
}
