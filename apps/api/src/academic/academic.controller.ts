import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Permissions } from '../roles/permissions.decorator';
import { PermissionsGuard } from '../roles/permissions.guard';
import { Permission } from '@la-chat/shared-types';
import { AcademicService } from './academic.service';
import {
  createClassSchema,
  createStreamSchema,
  createSubjectSchema,
} from '@la-chat/validation';
import { ZodValidationException } from '../common/zod-validation.exception';

@Controller('academic')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AcademicController {
  constructor(private academic: AcademicService) {}

  // Anyone authenticated can read the academic structure.
  @Get('classes')
  @Permissions(Permission.USER_READ_SELF)
  listClasses() {
    return this.academic.listClasses();
  }

  @Post('classes')
  @Permissions(Permission.CLASS_MANAGE)
  async createClass(@Body() body: unknown) {
    const parsed = createClassSchema.safeParse(body);
    if (!parsed.success) throw new ZodValidationException(parsed.error);
    return this.academic.createClass(parsed.data.level, parsed.data.name);
  }

  @Get('streams')
  @Permissions(Permission.USER_READ_SELF)
  listStreams(@Query('classId') classId?: string) {
    return this.academic.listStreams(classId);
  }

  @Post('streams')
  @Permissions(Permission.CLASS_MANAGE)
  async createStream(@Body() body: unknown) {
    const parsed = createStreamSchema.safeParse(body);
    if (!parsed.success) throw new ZodValidationException(parsed.error);
    return this.academic.createStream(parsed.data.classId, parsed.data.name);
  }

  @Get('subjects')
  @Permissions(Permission.USER_READ_SELF)
  listSubjects() {
    return this.academic.listSubjects();
  }

  @Post('subjects')
  @Permissions(Permission.SUBJECT_MANAGE)
  async createSubject(@Body() body: unknown) {
    const parsed = createSubjectSchema.safeParse(body);
    if (!parsed.success) throw new ZodValidationException(parsed.error);
    return this.academic.createSubject(parsed.data.name, parsed.data.code);
  }
}
