import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Mark a route as public (no JWT required). Used by the JwtAuthGuard default
 * implementation and by the global guard if one is added later.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
