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

// ---------------------------------------------------------------------------
// Messaging
// ---------------------------------------------------------------------------

const uuidSchema = z.string().uuid();
const emojiSchema = z.string().min(1).max(10);
const messageBodySchema = z.string().min(1).max(10_000);
const clientMessageIdSchema = z
  .string()
  .min(8, 'clientMessageId must be at least 8 chars')
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/, 'clientMessageId must be URL-safe');
const messageTypeSchema = z.enum(['TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'VOICE', 'DOCUMENT']);

export const createPrivateConversationSchema = z.object({
  participantId: uuidSchema,
});

export const createGroupConversationSchema = z.object({
  name: z.string().min(2).max(80),
  description: z.string().max(500).optional(),
  participantIds: z.array(uuidSchema).min(1).max(200),
  groupId: uuidSchema.optional(),
});

export const sendMessageSchema = z.object({
  conversationId: uuidSchema,
  clientMessageId: clientMessageIdSchema,
  type: messageTypeSchema.default('TEXT'),
  body: z.string().max(10_000).optional(),
  replyToId: uuidSchema.optional(),
});

export const editMessageSchema = z.object({
  body: messageBodySchema,
});

export const reactSchema = z.object({
  emoji: emojiSchema,
});

export const markReadSchema = z.object({
  lastReadMessageId: uuidSchema,
});

export const searchMessagesSchema = z.object({
  q: z.string().min(2).max(200),
  conversationId: uuidSchema.optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export const listConversationsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

export const listMessagesSchema = z.object({
  // cursor-based pagination: fetch messages older than this id
  before: uuidSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type CreatePrivateConversationInput = z.infer<typeof createPrivateConversationSchema>;
export type CreateGroupConversationInput = z.infer<typeof createGroupConversationSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type EditMessageInput = z.infer<typeof editMessageSchema>;
export type ReactInput = z.infer<typeof reactSchema>;
export type MarkReadInput = z.infer<typeof markReadSchema>;
export type SearchMessagesInput = z.infer<typeof searchMessagesSchema>;
export type ListConversationsInput = z.infer<typeof listConversationsSchema>;
export type ListMessagesInput = z.infer<typeof listMessagesSchema>;

// Media
export const mediaCategorySchema = z.enum(['image', 'document', 'voice', 'video', 'audio']);

export const MEDIA_LIMITS: Record<z.infer<typeof mediaCategorySchema>, { maxBytes: number; allowedMimePrefixes: string[] }> = {
  image:    { maxBytes: 10 * 1024 * 1024,  allowedMimePrefixes: ['image/'] },
  document: { maxBytes: 25 * 1024 * 1024,  allowedMimePrefixes: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'text/plain', 'text/csv', 'application/rtf'] },
  voice:    { maxBytes: 25 * 1024 * 1024,  allowedMimePrefixes: ['audio/webm', 'audio/ogg', 'audio/mpeg', 'audio/mp4', 'audio/aac'] },
  video:    { maxBytes: 100 * 1024 * 1024, allowedMimePrefixes: ['video/mp4', 'video/webm', 'video/quicktime', 'video/ogg'] },
  audio:    { maxBytes: 25 * 1024 * 1024,  allowedMimePrefixes: ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/aac', 'audio/flac'] },
};

export const FORBIDDEN_MIME_TYPES = new Set([
  'application/x-msdownload', 'application/x-executable', 'application/x-dosexec',
  'application/octet-stream', 'application/x-sh', 'application/x-bat',
  'application/x-python', 'application/javascript', 'text/html',
]);

export const uploadInitSchema = z.object({
  filename: z.string().min(1).max(255),
  mimeType: z.string().min(3).max(100),
  category: mediaCategorySchema,
  sizeBytes: z.number().int().positive().max(100 * 1024 * 1024),
}).superRefine((val, ctx) => {
  const limits = MEDIA_LIMITS[val.category];
  if (val.sizeBytes > limits.maxBytes) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['sizeBytes'], message: `File exceeds ${limits.maxBytes / 1024 / 1024}MB limit for category "${val.category}"` });
  }
  if (FORBIDDEN_MIME_TYPES.has(val.mimeType)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['mimeType'], message: 'This file type is not allowed' });
  }
  const mimeOk = limits.allowedMimePrefixes.some((p) => val.mimeType === p || val.mimeType.startsWith(p));
  if (!mimeOk) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['mimeType'], message: `MIME type "${val.mimeType}" is not allowed for category "${val.category}"` });
  }
});

// Notifications
export const notificationTypeSchema = z.enum([
  'message.new', 'announcement.new', 'announcement.ack',
  'report.status', 'account.approved', 'account.suspended', 'system',
]);

export const registerPushTokenSchema = z.object({
  platform: z.enum(['ANDROID', 'IOS', 'WEB']),
  token: z.string().min(10).max(4096),
  label: z.string().max(80).optional(),
});

export const updateNotificationPreferencesSchema = z.object({
  enabled: z.boolean(),
  perType: z.record(notificationTypeSchema, z.object({ inApp: z.boolean(), push: z.boolean() })).optional(),
  quietHoursStart: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional(),
  quietHoursEnd: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional(),
});

export type UploadInitInput = z.infer<typeof uploadInitSchema>;
export type RegisterPushTokenInput = z.infer<typeof registerPushTokenSchema>;
export type UpdateNotificationPreferencesInput = z.infer<typeof updateNotificationPreferencesSchema>;

// Announcements
export const announcementCategorySchema = z.enum(['SCHOOL_WIDE', 'CLASS', 'EXAM', 'TIMETABLE', 'ACADEMIC', 'EVENT', 'EMERGENCY', 'ADMINISTRATIVE']);
export const announcementPrioritySchema = z.enum(['LOW', 'NORMAL', 'HIGH', 'CRITICAL']);
export const announcementAudienceSchema = z.enum(['ALL', 'CLASS', 'STREAM', 'STAFF', 'PARENTS']);

export const createAnnouncementSchema = z.object({
  category: announcementCategorySchema,
  priority: announcementPrioritySchema.default('NORMAL'),
  audience: announcementAudienceSchema,
  title: z.string().min(2).max(200),
  body: z.string().min(1).max(10_000),
  expiresAt: z.string().datetime().optional(),
  targetClassId: z.string().uuid().optional(),
  targetStreamId: z.string().uuid().optional(),
}).superRefine((val, ctx) => {
  if (val.audience === 'CLASS' && !val.targetClassId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['targetClassId'], message: 'CLASS audience requires targetClassId' });
  }
  if (val.audience === 'STREAM' && !val.targetStreamId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['targetStreamId'], message: 'STREAM audience requires targetStreamId' });
  }
});

// Groups
export const groupTypeSchema = z.enum(['CLASS', 'STREAM', 'SUBJECT', 'DEPARTMENT', 'CLUB', 'ADMIN', 'PARENT']);
export const groupMemberRoleSchema = z.enum(['MEMBER', 'ADMIN']);

export const createGroupSchema = z.object({
  type: groupTypeSchema,
  name: z.string().min(2).max(80),
  description: z.string().max(500).optional(),
  classId: z.string().uuid().optional(),
  streamId: z.string().uuid().optional(),
  subjectId: z.string().uuid().optional(),
  memberUserIds: z.array(z.string().uuid()).optional(),
}).superRefine((val, ctx) => {
  if (val.type === 'CLASS' && !val.classId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['classId'], message: 'CLASS group requires classId' });
  }
  if (val.type === 'STREAM' && !val.streamId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['streamId'], message: 'STREAM group requires streamId' });
  }
  if (val.type === 'SUBJECT' && !val.subjectId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['subjectId'], message: 'SUBJECT group requires subjectId' });
  }
});

export const addGroupMemberSchema = z.object({
  userId: z.string().uuid(),
  role: groupMemberRoleSchema.default('MEMBER'),
});

export type CreateAnnouncementInput = z.infer<typeof createAnnouncementSchema>;
export type CreateGroupInput = z.infer<typeof createGroupSchema>;
export type AddGroupMemberInput = z.infer<typeof addGroupMemberSchema>;

// Moderation
export const reportCategorySchema = z.enum(['BULLYING', 'INAPPROPRIATE', 'SPAM', 'IMPERSONATION', 'THREAT', 'OTHER']);
export const moderationActionTypeSchema = z.enum(['WARN', 'REMOVE_MESSAGE', 'SUSPEND_ACCOUNT', 'DISMISS']);

export const createReportSchema = z.object({
  reportedUserId: z.string().uuid().optional(),
  reportedMessageId: z.string().uuid().optional(),
  category: reportCategorySchema,
  reason: z.string().min(3).max(1000),
}).superRefine((val, ctx) => {
  if (!val.reportedUserId && !val.reportedMessageId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['reportedMessageId'], message: 'Must report a user or a message' });
  }
});

export const takeModerationActionSchema = z.object({
  action: moderationActionTypeSchema,
  note: z.string().max(1000).optional(),
});

// Audit log query
export const listAuditLogsSchema = z.object({
  actorId: z.string().uuid().optional(),
  action: z.string().optional(),
  targetType: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

export type CreateReportInput = z.infer<typeof createReportSchema>;
export type TakeModerationActionInput = z.infer<typeof takeModerationActionSchema>;
export type ListAuditLogsInput = z.infer<typeof listAuditLogsSchema>;
