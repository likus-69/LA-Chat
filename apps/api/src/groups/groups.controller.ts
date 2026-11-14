import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Delete, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Permissions } from '../roles/permissions.decorator';
import { PermissionsGuard } from '../roles/permissions.guard';
import { Permission } from '@la-chat/shared-types';
import { CurrentUser } from '../users/current-user.decorator';
import { GroupsService } from './groups.service';
import { createGroupSchema, addGroupMemberSchema } from '@la-chat/validation';
import { ZodValidationException } from '../common/zod-validation.exception';
import { AuthedUser } from '../auth/auth.types';

@Controller('groups')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class GroupsController {
  constructor(private groups: GroupsService) {}

  @Get()
  @Permissions(Permission.USER_READ_SELF)
  async list(@CurrentUser() user: AuthedUser) { return this.groups.list(user.id); }

  @Get(':id')
  @Permissions(Permission.USER_READ_SELF)
  async getById(@CurrentUser() user: AuthedUser, @Param('id', ParseUUIDPipe) id: string) { return this.groups.getById(user.id, id); }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Permissions(Permission.CONVERSATION_CREATE_GROUP)
  async create(@CurrentUser() user: AuthedUser, @Body() body: unknown) {
    const parsed = createGroupSchema.safeParse(body);
    if (!parsed.success) throw new ZodValidationException(parsed.error);
    return this.groups.create(user.id, parsed.data);
  }

  @Post(':id/members')
  @HttpCode(HttpStatus.OK)
  @Permissions(Permission.CONVERSATION_ADD_MEMBERS)
  async addMember(@CurrentUser() user: AuthedUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    const parsed = addGroupMemberSchema.safeParse(body);
    if (!parsed.success) throw new ZodValidationException(parsed.error);
    await this.groups.addMember(user.id, id, parsed.data.userId, parsed.data.role);
    return { ok: true };
  }

  @Delete(':id/members/:userId')
  @HttpCode(HttpStatus.OK)
  @Permissions(Permission.CONVERSATION_REMOVE_MEMBERS)
  async removeMember(@CurrentUser() user: AuthedUser, @Param('id', ParseUUIDPipe) id: string, @Param('userId', ParseUUIDPipe) userId: string) {
    await this.groups.removeMember(user.id, id, userId);
    return { ok: true };
  }
}
