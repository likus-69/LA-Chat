import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Permissions } from '../roles/permissions.decorator';
import { PermissionsGuard } from '../roles/permissions.guard';
import { Permission, RoleName, AccountStatus } from '@la-chat/shared-types';
import { CurrentUser } from './current-user.decorator';
import { UsersService } from './users.service';
import { CsvImportService } from './csv-import.service';
import { suspendUserSchema, updateProfileSchema } from '@la-chat/validation';
import { ZodValidationException } from '../common/zod-validation.exception';
import { AuthedUser } from '../auth/auth.types';

@Controller('users')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class UsersController {
  constructor(
    private users: UsersService,
    private csvImport: CsvImportService,
  ) {}

  @Get('me')
  @Permissions(Permission.USER_READ_SELF)
  async me(@CurrentUser() user: AuthedUser) {
    return this.users.getProfile(user.id);
  }

  @Patch('me')
  @Permissions(Permission.USER_UPDATE_SELF)
  async updateMe(@CurrentUser() user: AuthedUser, @Body() body: unknown) {
    const parsed = updateProfileSchema.safeParse(body);
    if (!parsed.success) throw new ZodValidationException(parsed.error);
    return this.users.updateOwnProfile(user.id, parsed.data);
  }

  @Get('me/sessions')
  @Permissions(Permission.USER_READ_SELF)
  async mySessions(@CurrentUser() user: AuthedUser) {
    return { items: await this.users.listSessions(user.id, user.sessionId) };
  }

  @Delete('me/sessions/:id')
  @Permissions(Permission.USER_UPDATE_SELF)
  async revokeSession(
    @CurrentUser() user: AuthedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.users.revokeSession(user.id, id);
  }

  @Delete('me/sessions')
  @Permissions(Permission.USER_UPDATE_SELF)
  async revokeOtherSessions(@CurrentUser() user: AuthedUser) {
    return this.users.revokeOtherSessions(user.id, user.sessionId);
  }

  @Get()
  @Permissions(Permission.USER_READ_STUDENTS, Permission.USER_READ_STAFF)
  async list(
    @Query('role') role?: RoleName,
    @Query('status') status?: AccountStatus,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.users.list({
      role,
      status,
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 20,
    });
  }

  @Post('import')
  @Permissions(Permission.USER_IMPORT_CSV)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  async importUsers(@UploadedFile() file: Express.Multer.File, @CurrentUser() actor: AuthedUser) {
    if (!file) throw new BadRequestException('No file uploaded');
    const csvText = file.buffer.toString('utf-8');
    return this.csvImport.importUsers(csvText, actor.id);
  }

  @Get('import/template')
  @Permissions(Permission.USER_IMPORT_CSV)
  async importTemplate(@Res() res: Response) {
    const csv = this.csvImport.getTemplateCsv();
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="la-chat-import-template.csv"');
    res.send(csv);
  }

  @Get('export')
  @Permissions(Permission.USER_EXPORT_CSV)
  async exportUsers(@Res() res: Response, @Query('role') role?: string, @Query('status') status?: string) {
    const csv = await this.csvImport.exportUsersCsv({ role, status });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="la-chat-users.csv"');
    res.send(csv);
  }

  @Post(':id/approve')
  @Permissions(Permission.USER_UPDATE_OTHERS)
  async approve(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthedUser) {
    return this.users.approve(id, actor.id);
  }

  @Post(':id/suspend')
  @Permissions(Permission.USER_SUSPEND)
  async suspend(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthedUser,
    @Body() body: unknown,
  ) {
    const parsed = suspendUserSchema.safeParse(body);
    if (!parsed.success) throw new ZodValidationException(parsed.error);
    return this.users.suspend(id, parsed.data.reason, actor.id);
  }

  @Post(':id/restore')
  @Permissions(Permission.USER_RESTORE)
  async restore(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthedUser) {
    return this.users.restore(id, actor.id);
  }

  @Post(':id/reset-password')
  @Permissions(Permission.USER_RESET_PASSWORD)
  async resetPassword(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthedUser) {
    return this.users.resetPassword(id, actor.id);
  }
}
