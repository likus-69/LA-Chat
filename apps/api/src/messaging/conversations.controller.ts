import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Permissions } from '../roles/permissions.decorator';
import { PermissionsGuard } from '../roles/permissions.guard';
import { Permission } from '@la-chat/shared-types';
import { CurrentUser } from '../users/current-user.decorator';
import { ConversationsService } from './conversations.service';
import {
  createGroupConversationSchema,
  createPrivateConversationSchema,
  listConversationsSchema,
} from '@la-chat/validation';
import { ZodValidationException } from '../common/zod-validation.exception';
import { AuthedUser } from '../auth/auth.types';

@Controller('conversations')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ConversationsController {
  constructor(private conversations: ConversationsService) {}

  @Get()
  @Permissions(Permission.USER_READ_SELF)
  async list(
    @CurrentUser() user: AuthedUser,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const parsed = listConversationsSchema.safeParse({
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 50,
    });
    if (!parsed.success) throw new ZodValidationException(parsed.error);
    return this.conversations.list(user.id, parsed.data);
  }

  @Get(':id')
  @Permissions(Permission.USER_READ_SELF)
  async getById(@CurrentUser() user: AuthedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.conversations.getById(user.id, id);
  }

  @Post('private')
  @HttpCode(HttpStatus.CREATED)
  @Permissions(Permission.CONVERSATION_CREATE_PRIVATE)
  async createPrivate(@CurrentUser() user: AuthedUser, @Body() body: unknown) {
    const parsed = createPrivateConversationSchema.safeParse(body);
    if (!parsed.success) throw new ZodValidationException(parsed.error);
    return this.conversations.createPrivate(user.id, parsed.data.participantId);
  }

  @Post('group')
  @HttpCode(HttpStatus.CREATED)
  @Permissions(Permission.CONVERSATION_CREATE_GROUP)
  async createGroup(@CurrentUser() user: AuthedUser, @Body() body: unknown) {
    const parsed = createGroupConversationSchema.safeParse(body);
    if (!parsed.success) throw new ZodValidationException(parsed.error);
    return this.conversations.createGroup(user.id, parsed.data);
  }
}
