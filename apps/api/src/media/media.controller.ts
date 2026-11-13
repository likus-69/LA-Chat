import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Permissions } from '../roles/permissions.decorator';
import { PermissionsGuard } from '../roles/permissions.guard';
import { Permission } from '@la-chat/shared-types';
import { CurrentUser } from '../users/current-user.decorator';
import { MediaService } from './media.service';
import { AuthedUser } from '../auth/auth.types';

@Controller('media')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class MediaController {
  constructor(private media: MediaService) {}

  @Post('init')
  @HttpCode(HttpStatus.CREATED)
  @Permissions(Permission.MESSAGE_SEND)
  async initUpload(@CurrentUser() user: AuthedUser, @Body() body: unknown) {
    return this.media.initUpload(user.id, body);
  }

  @Post(':id/confirm')
  @HttpCode(HttpStatus.OK)
  @Permissions(Permission.MESSAGE_SEND)
  async confirmUpload(@CurrentUser() user: AuthedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.media.confirmUpload(user.id, id);
  }

  @Get(':id')
  @Permissions(Permission.MESSAGE_SEND)
  async getDownloadUrl(@CurrentUser() user: AuthedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.media.getDownloadUrl(user.id, id);
  }
}
