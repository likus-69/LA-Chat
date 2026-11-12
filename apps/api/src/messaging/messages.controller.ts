import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Permissions } from '../roles/permissions.decorator';
import { PermissionsGuard } from '../roles/permissions.guard';
import { Permission } from '@la-chat/shared-types';
import { CurrentUser } from '../users/current-user.decorator';
import { MessagesService } from './messages.service';
import {
  editMessageSchema,
  listMessagesSchema,
  markReadSchema,
  reactSchema,
  searchMessagesSchema,
  sendMessageSchema,
} from '@la-chat/validation';
import { ZodValidationException } from '../common/zod-validation.exception';
import { AuthedUser } from '../auth/auth.types';

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class MessagesController {
  constructor(private messages: MessagesService) {}

  // POST /conversations/:conversationId/messages
  @Post('conversations/:conversationId/messages')
  @HttpCode(HttpStatus.CREATED)
  @Permissions(Permission.MESSAGE_SEND)
  async send(
    @CurrentUser() user: AuthedUser,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Body() body: unknown,
  ) {
    const parsed = sendMessageSchema.safeParse(body);
    if (!parsed.success) throw new ZodValidationException(parsed.error);
    // Override conversationId from the URL to prevent path/body mismatch
    const { message, created } = await this.messages.send({
      conversationId,
      senderId: user.id,
      clientMessageId: parsed.data.clientMessageId,
      type: parsed.data.type,
      body: parsed.data.body,
      replyToId: parsed.data.replyToId,
    });
    // REST callers get 201 on create, 200 on idempotent replay
    return { message, created };
  }

  // GET /conversations/:conversationId/messages?before=<id>&limit=<n>
  @Get('conversations/:conversationId/messages')
  @Permissions(Permission.MESSAGE_SEARCH) // reuse search perm for "read history"
  async list(
    @CurrentUser() user: AuthedUser,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Query('before') before?: string,
    @Query('limit') limit?: string,
  ) {
    const parsed = listMessagesSchema.safeParse({
      before,
      limit: limit ? parseInt(limit, 10) : 50,
    });
    if (!parsed.success) throw new ZodValidationException(parsed.error);
    return this.messages.list(user.id, conversationId, parsed.data);
  }

  // PATCH /messages/:id
  @Patch('messages/:id')
  @Permissions(Permission.MESSAGE_EDIT_SELF)
  async edit(
    @CurrentUser() user: AuthedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    const parsed = editMessageSchema.safeParse(body);
    if (!parsed.success) throw new ZodValidationException(parsed.error);
    return this.messages.edit(user.id, id, parsed.data.body);
  }

  // DELETE /messages/:id
  @Delete('messages/:id')
  @HttpCode(HttpStatus.OK)
  @Permissions(Permission.MESSAGE_DELETE_SELF)
  async delete(@CurrentUser() user: AuthedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.messages.delete(user.id, id);
  }

  // POST /messages/:id/reactions
  @Post('messages/:id/reactions')
  @HttpCode(HttpStatus.OK)
  @Permissions(Permission.MESSAGE_SEND) // reacting requires same perm as sending
  async addReaction(
    @CurrentUser() user: AuthedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    const parsed = reactSchema.safeParse(body);
    if (!parsed.success) throw new ZodValidationException(parsed.error);
    const reactions = await this.messages.addReaction(user.id, id, parsed.data.emoji);
    return { messageId: id, reactions };
  }

  // DELETE /messages/:id/reactions/:emoji
  @Delete('messages/:id/reactions/:emoji')
  @HttpCode(HttpStatus.OK)
  @Permissions(Permission.MESSAGE_SEND)
  async removeReaction(
    @CurrentUser() user: AuthedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('emoji') emoji: string,
  ) {
    const reactions = await this.messages.removeReaction(user.id, id, decodeURIComponent(emoji));
    return { messageId: id, reactions };
  }

  // POST /conversations/:conversationId/read
  @Post('conversations/:conversationId/read')
  @HttpCode(HttpStatus.OK)
  @Permissions(Permission.MESSAGE_SEND)
  async markRead(
    @CurrentUser() user: AuthedUser,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Body() body: unknown,
  ) {
    const parsed = markReadSchema.safeParse(body);
    if (!parsed.success) throw new ZodValidationException(parsed.error);
    await this.messages.markRead(user.id, conversationId, parsed.data.lastReadMessageId);
    return { ok: true };
  }

  // GET /messages/search?q=...
  @Get('messages/search')
  @Permissions(Permission.MESSAGE_SEARCH)
  async search(
    @CurrentUser() user: AuthedUser,
    @Query('q') q: string,
    @Query('conversationId') conversationId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const parsed = searchMessagesSchema.safeParse({
      q,
      conversationId,
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 20,
    });
    if (!parsed.success) throw new ZodValidationException(parsed.error);
    return this.messages.search(user.id, parsed.data.q, parsed.data);
  }
}
