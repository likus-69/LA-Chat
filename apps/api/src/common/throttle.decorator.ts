import {
  CanActivate,
  ExecutionContext,
  Injectable,
  HttpStatus,
  HttpException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export const THROTTLE_KEY = 'throttle';
export interface ThrottleOpts {
  limit: number;
  windowSec: number;
}

/**
 * Decorate a handler with a per-IP rate limit.
 *
 *   @Throttle({ limit: 10, windowSec: 60 })
 *
 * Implementation is an in-memory rolling window per process — sufficient for
 * a single-school deployment. For multi-instance we would move to Redis.
 */
export const Throttle = (opts: ThrottleOpts) => SetMetadata(THROTTLE_KEY, opts);

interface Hit {
  ts: number;
}
const buckets = new Map<string, Hit[]>();

@Injectable()
export class ThrottleGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const opts = this.reflector.getAllAndOverride<ThrottleOpts>(THROTTLE_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!opts) return true;

    const req = ctx.switchToHttp().getRequest<{ ip?: string; headers: Record<string, string> }>();
    const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const key = `${req.headers['user-agent'] || ''}|${ip}|${ctx.getHandler().name}`;

    const now = Date.now();
    const windowStart = now - opts.windowSec * 1000;
    const hits = (buckets.get(key) ?? []).filter((h) => h.ts > windowStart);
    if (hits.length >= opts.limit) {
      throw new HttpException(
        'Too many requests',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    hits.push({ ts: now });
    buckets.set(key, hits);
    return true;
  }
}
