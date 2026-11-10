import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Default auth guard. Use `@UseGuards(JwtAuthGuard)` on any route that
 * requires authentication. Combine with `@Permissions(...)` and
 * `PermissionsGuard` for permission checks.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
