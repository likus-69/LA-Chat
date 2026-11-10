import { Body, Controller, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import {
  loginSchema,
  refreshSchema,
  registerStaffSchema,
  registerStudentSchema,
} from '@la-chat/validation';
import { ZodValidationException } from '../common/zod-validation.exception';
import { Throttle } from '../common/throttle.decorator';
import { Public } from './public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Public()
  @Throttle({ limit: 10, windowSec: 60 }) // 10 attempts per minute per IP
  @Post('register/student')
  @HttpCode(HttpStatus.CREATED)
  async registerStudent(@Body() body: unknown) {
    const parsed = registerStudentSchema.safeParse(body);
    if (!parsed.success) throw new ZodValidationException(parsed.error);
    return this.auth.registerStudent(parsed.data);
  }

  @Public()
  @Throttle({ limit: 10, windowSec: 60 })
  @Post('register/staff')
  @HttpCode(HttpStatus.CREATED)
  async registerStaff(@Body() body: unknown) {
    const parsed = registerStaffSchema.safeParse(body);
    if (!parsed.success) throw new ZodValidationException(parsed.error);
    return this.auth.registerStaff(parsed.data);
  }

  @Public()
  @Throttle({ limit: 10, windowSec: 60 })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: unknown, @Req() req: Request) {
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) throw new ZodValidationException(parsed.error);
    return this.auth.login(parsed.data, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      deviceId: parsed.data.deviceId,
    });
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() body: unknown, @Req() req: Request) {
    const parsed = refreshSchema.safeParse(body);
    if (!parsed.success) throw new ZodValidationException(parsed.error);
    return this.auth.refresh(parsed.data.refreshToken, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Body() body: unknown) {
    const parsed = refreshSchema.safeParse(body);
    if (!parsed.success) throw new ZodValidationException(parsed.error);
    return this.auth.logout(parsed.data.refreshToken);
  }
}
