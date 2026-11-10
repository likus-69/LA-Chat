import { BadRequestException } from '@nestjs/common';
import { ZodError } from 'zod';

/**
 * Thrown when a Zod schema parse fails inside a controller/service.
 * The global exception filter turns this into a 400 response with a
 * structured `issues` array.
 */
export class ZodValidationException extends BadRequestException {
  constructor(public readonly zodError: ZodError) {
    super({
      message: 'Validation failed',
      issues: zodError.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
        code: i.code,
      })),
    });
  }
}
