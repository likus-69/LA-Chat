import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { AcademicModule } from './academic/academic.module';
import { MessagingModule } from './messaging/messaging.module';
import { MediaModule } from './media/media.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AnnouncementsModule } from './announcements/announcements.module';
import { GroupsModule } from './groups/groups.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { ModerationModule } from './moderation/moderation.module';
import { AuditModule } from './audit/audit.module';
import { RolesModule } from './roles/roles.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    PrismaModule,
    RolesModule,
    AuthModule,
    UsersModule,
    AcademicModule,
    MediaModule,
    NotificationsModule,
    MessagingModule,
    AnnouncementsModule,
    GroupsModule,
    DashboardModule,
    ModerationModule,
    AuditModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
