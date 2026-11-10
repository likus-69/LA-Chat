import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthedUser } from '../auth/auth.types';

/**
 * Extract the authenticated user from the request. Throws at runtime if the
 * route is not behind JwtAuthGuard.
 *
 *   @Get('me')
 *   @UseGuards(JwtAuthGuard)
 *   me(@CurrentUser() user: AuthedUser) { ... }
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthedUser => {
    const req = ctx.switchToHttp().getRequest<{ user?: AuthedUser }>();
    if (!req.user) {
      throw new Error('CurrentUser used on an unauthenticated route');
    }
    return req.user;
  },
);
