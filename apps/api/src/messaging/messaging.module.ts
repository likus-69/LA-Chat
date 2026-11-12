import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RolesModule } from '../roles/roles.module';
import { UsersModule } from '../users/users.module';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ConversationPolicy } from './conversation.policy';
import { ConversationsService } from './conversations.service';
import { ConversationsController } from './conversations.controller';
import { MessagesService } from './messages.service';
import { MessagesController } from './messages.controller';
import { MessagingGateway } from './messaging.gateway';

@Module({
  imports: [
    PrismaModule,
    RolesModule,
    UsersModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_ACCESS_SECRET', 'dev-only-insecure-secret-change-me'),
      }),
    }),
  ],
  controllers: [ConversationsController, MessagesController],
  providers: [
    ConversationPolicy,
    ConversationsService,
    MessagesService,
    MessagingGateway,
  ],
  exports: [ConversationsService, MessagesService],
})
export class MessagingModule {}
