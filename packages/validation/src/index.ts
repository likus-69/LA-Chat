/**
 * @la-chat/validation
 *
 * Zod schemas for every DTO. Used by both the API (request validation) and
 * the clients (form validation) so the rules can never drift.
 */
import { z } from 'zod';
import { RoleName, AccountStatus, ALL_ROLES } from '@la-chat/shared-types';

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password is too long')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/[0-9]/, 'Password must contain a digit');

export const emailSchema = z.string().email().max(254).optional().or(z.literal(''));
export const phoneSchema = z
  .string()
  .regex(/^\+?[0-9]{7,15}$/, 'Phone must be 7-15 digits, optionally prefixed with +')
  .optional()
  .or(z.literal(''));

export const admissionNoSchema = z
  .string()
  .min(3, 'Admission number is required')
  .max(32)
  .regex(/^[A-Za-z0-9-]+$/, 'Admission number may contain letters, digits and hyphens only');

export const staffNoSchema = z
  .string()
  .min(3, 'Staff number is required')
  .max(32)
  .regex(/^[A-Za-z0-9-]+$/, 'Staff number may contain letters, digits and hyphens only');

export const fullNameSchema = z
  .string()
  .min(2, 'Full name is required')
  .max(120, 'Full name is too long')
  .trim();

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export const registerStudentSchema = z.object({
  admissionNo: admissionNoSchema,
  fullName: fullNameSchema,
  email: emailSchema,
  phone: phoneSchema,
  password: passwordSchema,
  classId: z.string().uuid('classId must be a UUID'),
  streamId: z.string().uuid('streamId must be a UUID'),
});

export const registerStaffSchema = z.object({
  staffNo: staffNoSchema,
  fullName: fullNameSchema,
  email: emailSchema,
  phone: phoneSchema,
  password: passwordSchema,
  department: z.string().max(80).optional(),
  role: z.enum(ALL_ROLES as [RoleName, ...RoleName[]]).refine(
    (r) =>
      ![
        RoleName.STUDENT,
        RoleName.PARENT_GUARDIAN,
      ].includes(r),
    'Use the student or parent registration endpoint for those roles',
  ),
});

export const loginSchema = z.object({
  identifier: z.string().min(3, 'Identifier is required').max(254),
  password: z.string().min(1, 'Password is required').max(128),
  deviceId: z.string().max(120).optional(),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export const updateProfileSchema = z.object({
  fullName: fullNameSchema.optional(),
  email: emailSchema,
  phone: phoneSchema,
});

export const suspendUserSchema = z.object({
  reason: z.string().min(3).max(500),
});

export const roleSchema = z.enum(ALL_ROLES as [RoleName, ...RoleName[]]);

// ---------------------------------------------------------------------------
// Academic
// ---------------------------------------------------------------------------

export const createClassSchema = z.object({
  level: z.number().int().min(1).max(6, 'S1=1 … S6=6'),
  name: z.string().min(2).max(80),
});

export const createStreamSchema = z.object({
  classId: z.string().uuid(),
  name: z.string().min(1).max(60),
});

export const createSubjectSchema = z.object({
  name: z.string().min(2).max(80),
  code: z.string().min(1).max(16),
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RegisterStudentInput = z.infer<typeof registerStudentSchema>;
export type RegisterStaffInput = z.infer<typeof registerStaffSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type CreateClassInput = z.infer<typeof createClassSchema>;
export type CreateStreamInput = z.infer<typeof createStreamSchema>;
export type CreateSubjectInput = z.infer<typeof createSubjectSchema>;
