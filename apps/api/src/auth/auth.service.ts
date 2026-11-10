import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import {
  AccountStatus,
  RoleName,
  Permission,
} from '@la-chat/shared-types';
import { RolesService } from '../roles/roles.service';
import { AuthedUser, JwtPayload } from './auth.types';
import { LoginInput, RegisterStudentInput, RegisterStaffInput } from '@la-chat/validation';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private roles: RolesService,
    private users: UsersService,
  ) {}

  // -------------------------------------------------------------------------
  // Registration
  // -------------------------------------------------------------------------

  async registerStudent(input: RegisterStudentInput): Promise<{ userId: string; status: AccountStatus }> {
    // Verify the class + stream exist and the stream belongs to the class.
    const stream = await this.prisma.stream.findUnique({
      where: { id: input.streamId },
      include: { class: true },
    });
    if (!stream) throw new BadRequestException('Stream not found');
    if (stream.classId !== input.classId) {
      throw new BadRequestException('Stream does not belong to the selected class');
    }

    // Admission number must be unique.
    const existing = await this.prisma.studentProfile.findUnique({
      where: { admissionNo: input.admissionNo },
    });
    if (existing) throw new ConflictException('Admission number is already registered');

    // Email/phone uniqueness too.
    if (input.email) {
      const e = await this.prisma.user.findUnique({ where: { email: input.email } });
      if (e) throw new ConflictException('Email already in use');
    }
    if (input.phone) {
      const p = await this.prisma.user.findUnique({ where: { phone: input.phone } });
      if (p) throw new ConflictException('Phone number already in use');
    }

    const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });

    const user = await this.prisma.user.create({
      data: {
        fullName: input.fullName,
        email: input.email || null,
        phone: input.phone || null,
        passwordHash,
        status: AccountStatus.PENDING,
        roles: {
          create: [
            {
              role: { connect: { name: RoleName.STUDENT } },
            },
          ],
        },
        studentProfile: {
          create: {
            admissionNo: input.admissionNo,
            classId: input.classId,
            streamId: input.streamId,
          },
        },
      },
      include: { roles: { include: { role: true } } },
    });

    return { userId: user.id, status: user.status as AccountStatus };
  }

  async registerStaff(input: RegisterStaffInput): Promise<{ userId: string; status: AccountStatus }> {
    const existing = await this.prisma.staffProfile.findUnique({
      where: { staffNo: input.staffNo },
    });
    if (existing) throw new ConflictException('Staff number is already registered');

    if (input.email) {
      const e = await this.prisma.user.findUnique({ where: { email: input.email } });
      if (e) throw new ConflictException('Email already in use');
    }
    if (input.phone) {
      const p = await this.prisma.user.findUnique({ where: { phone: input.phone } });
      if (p) throw new ConflictException('Phone number already in use');
    }

    const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });

    const user = await this.prisma.user.create({
      data: {
        fullName: input.fullName,
        email: input.email || null,
        phone: input.phone || null,
        passwordHash,
        status: AccountStatus.PENDING,
        roles: {
          create: [
            {
              role: { connect: { name: input.role } },
            },
          ],
        },
        staffProfile: {
          create: {
            staffNo: input.staffNo,
            department: input.department || null,
          },
        },
      },
    });

    return { userId: user.id, status: AccountStatus.PENDING };
  }

  // -------------------------------------------------------------------------
  // Login + logout + refresh
  // -------------------------------------------------------------------------

  async login(input: LoginInput, meta: { ip?: string; userAgent?: string; deviceId?: string }) {
    const user = await this.users.findByIdentifier(input.identifier);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    if (user.status === AccountStatus.SUSPENDED) {
      throw new ForbiddenException('Account suspended. Contact the school administrator.');
    }
    if (user.status === AccountStatus.DELETED) {
      throw new UnauthorizedException('Account not found');
    }
    if (user.status === AccountStatus.PENDING) {
      throw new ForbiddenException('Account pending approval by the school administrator.');
    }

    const ok = await argon2.verify(user.passwordHash, input.password);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    const roles = user.roles.map((ur) => ur.role.name) as RoleName[];
    const payload: JwtPayload = {
      sub: user.id,
      roles,
      status: user.status as AccountStatus,
    };

    const accessToken = await this.jwt.signAsync(payload);
    const refreshToken = await this.issueRefreshToken(user.id, meta);

    const profile = await this.users.getProfile(user.id);

    return {
      user: profile,
      tokens: {
        accessToken,
        refreshToken: refreshToken.plain,
        expiresIn: this.accessTokenTtlSeconds(),
      },
    };
  }

  async refresh(refreshToken: string, meta: { ip?: string; userAgent?: string }) {
    const hash = this.hashToken(refreshToken);
    const session = await this.prisma.userSession.findUnique({
      where: { refreshTokenHash: hash },
      include: { user: { include: { roles: { include: { role: true } } } } },
    });
    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Rotate: revoke this session, issue a new one.
    await this.prisma.userSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });

    const roles = session.user.roles.map((ur) => ur.role.name) as RoleName[];
    const payload: JwtPayload = {
      sub: session.user.id,
      roles,
      status: session.user.status as AccountStatus,
    };
    const accessToken = await this.jwt.signAsync(payload);
    const newRefresh = await this.issueRefreshToken(session.user.id, meta);

    const profile = await this.users.getProfile(session.user.id);

    return {
      user: profile,
      tokens: {
        accessToken,
        refreshToken: newRefresh.plain,
        expiresIn: this.accessTokenTtlSeconds(),
      },
    };
  }

  async logout(refreshToken: string) {
    const hash = this.hashToken(refreshToken);
    await this.prisma.userSession.updateMany({
      where: { refreshTokenHash: hash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { ok: true };
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private async issueRefreshToken(userId: string, meta: { ip?: string; userAgent?: string; deviceId?: string }) {
    const plain = randomBytes(32).toString('base64url');
    const hash = this.hashToken(plain);
    const ttlDays = parseInt(this.config.get<string>('JWT_REFRESH_TTL_DAYS', '7'), 10);
    const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);

    const session = await this.prisma.userSession.create({
      data: {
        userId,
        refreshTokenHash: hash,
        ipAddress: meta.ip ?? null,
        userAgent: meta.userAgent ?? null,
        expiresAt,
      },
    });
    return { id: session.id, plain };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private accessTokenTtlSeconds(): number {
    // Parse the JWT_ACCESS_TTL string (e.g. "15m") into seconds. Simple parser.
    const ttl = this.config.get<string>('JWT_ACCESS_TTL', '15m');
    const m = /^(\d+)([smhd])$/.exec(ttl);
    if (!m) return 900;
    const n = parseInt(m[1], 10);
    const unit = m[2];
    const mult = unit === 's' ? 1 : unit === 'm' ? 60 : unit === 'h' ? 3600 : 86400;
    return n * mult;
  }

  /** Used by JwtStrategy to rehydrate req.user. */
  async toAuthedUser(payload: JwtPayload): Promise<AuthedUser | null> {
    if (payload.status !== AccountStatus.ACTIVE) return null;
    return { id: payload.sub, roles: payload.roles, status: payload.status };
  }
}
