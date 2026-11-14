/**
 * @la-chat/shared-types
 *
 * Runtime-free DTOs, enums and API contracts shared across web, mobile and API.
 * No Node-only APIs. Safe to import in browsers, React Native and Node.
 */

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------

export enum RoleName {
  STUDENT = 'STUDENT',
  TEACHER = 'TEACHER',
  CLASS_TEACHER = 'CLASS_TEACHER',
  HEADTEACHER = 'HEADTEACHER',
  DEPUTY_HEADTEACHER = 'DEPUTY_HEADTEACHER',
  SCHOOL_ADMINISTRATOR = 'SCHOOL_ADMINISTRATOR',
  ICT_ADMINISTRATOR = 'ICT_ADMINISTRATOR',
  SCHOOL_SECRETARY = 'SCHOOL_SECRETARY',
  PARENT_GUARDIAN = 'PARENT_GUARDIAN',
}

export const ALL_ROLES: RoleName[] = Object.values(RoleName);

// ---------------------------------------------------------------------------
// Permissions
// ---------------------------------------------------------------------------

export enum Permission {
  // Users
  USER_CREATE = 'user.create',
  USER_READ_SELF = 'user.read.self',
  USER_READ_STUDENTS = 'user.read.students',
  USER_READ_STAFF = 'user.read.staff',
  USER_UPDATE_SELF = 'user.update.self',
  USER_UPDATE_OTHERS = 'user.update.others',
  USER_SUSPEND = 'user.suspend',
  USER_RESTORE = 'user.restore',
  USER_RESET_PASSWORD = 'user.reset_password',
  USER_IMPORT_CSV = 'user.import_csv',
  USER_EXPORT_CSV = 'user.export_csv',
  // Academic
  CLASS_MANAGE = 'class.manage',
  SUBJECT_MANAGE = 'subject.manage',
  ENROLMENT_MANAGE = 'enrolment.manage',
  // Messaging
  CONVERSATION_CREATE_PRIVATE = 'conversation.create.private',
  CONVERSATION_CREATE_GROUP = 'conversation.create.group',
  CONVERSATION_MANAGE_GROUP = 'conversation.manage.group',
  CONVERSATION_ADD_MEMBERS = 'conversation.add_members',
  CONVERSATION_REMOVE_MEMBERS = 'conversation.remove_members',
  CONVERSATION_PIN_MESSAGE = 'conversation.pin_message',
  MESSAGE_SEND = 'message.send',
  MESSAGE_EDIT_SELF = 'message.edit.self',
  MESSAGE_DELETE_SELF = 'message.delete.self',
  MESSAGE_DELETE_OTHERS = 'message.delete.others',
  MESSAGE_SEARCH = 'message.search',
  // Announcements
  ANNOUNCEMENT_PUBLISH_CLASS = 'announcement.publish.class',
  ANNOUNCEMENT_PUBLISH_STREAM = 'announcement.publish.stream',
  ANNOUNCEMENT_PUBLISH_STAFF = 'announcement.publish.staff',
  ANNOUNCEMENT_PUBLISH_SCHOOL = 'announcement.publish.school',
  ANNOUNCEMENT_PUBLISH_ADMIN = 'announcement.publish.admin',
  ANNOUNCEMENT_DELETE = 'announcement.delete',
  // Moderation
  REPORT_CREATE = 'report.create',
  REPORT_REVIEW = 'report.review',
  MODERATION_ACCESS_PRIVATE = 'moderation.access_private',
  // System
  SYSTEM_SETTINGS = 'system.settings',
  SYSTEM_AUDIT_READ = 'system.audit.read',
  SYSTEM_BACKUP_MANAGE = 'system.backup.manage',
  SYSTEM_DB_MAINTAIN = 'system.db.maintain',
  SYSTEM_DEPLOY = 'system.deploy',
}

/**
 * The canonical role → permission map. Mirror of
 * documentation/security/permissions-matrix.md. The API loads this at
 * bootstrap to seed the `role_permissions` table.
 */
export const ROLE_PERMISSIONS: Record<RoleName, Permission[]> = {
  [RoleName.STUDENT]: [
    Permission.USER_READ_SELF,
    Permission.USER_UPDATE_SELF,
    Permission.CONVERSATION_CREATE_PRIVATE,
    Permission.MESSAGE_SEND,
    Permission.MESSAGE_EDIT_SELF,
    Permission.MESSAGE_DELETE_SELF,
    Permission.MESSAGE_SEARCH,
    Permission.REPORT_CREATE,
  ],
  [RoleName.TEACHER]: [
    Permission.USER_READ_SELF,
    Permission.USER_UPDATE_SELF,
    Permission.USER_READ_STUDENTS,
    Permission.CONVERSATION_CREATE_PRIVATE,
    Permission.CONVERSATION_CREATE_GROUP,
    Permission.CONVERSATION_MANAGE_GROUP,
    Permission.CONVERSATION_ADD_MEMBERS,
    Permission.CONVERSATION_REMOVE_MEMBERS,
    Permission.CONVERSATION_PIN_MESSAGE,
    Permission.MESSAGE_SEND,
    Permission.MESSAGE_EDIT_SELF,
    Permission.MESSAGE_DELETE_SELF,
    Permission.MESSAGE_SEARCH,
    Permission.ANNOUNCEMENT_PUBLISH_CLASS,
    Permission.ANNOUNCEMENT_PUBLISH_STREAM,
    Permission.ANNOUNCEMENT_DELETE,
    Permission.REPORT_CREATE,
  ],
  [RoleName.CLASS_TEACHER]: [
    Permission.USER_READ_SELF,
    Permission.USER_UPDATE_SELF,
    Permission.USER_READ_STUDENTS,
    Permission.CONVERSATION_CREATE_PRIVATE,
    Permission.CONVERSATION_CREATE_GROUP,
    Permission.CONVERSATION_MANAGE_GROUP,
    Permission.CONVERSATION_ADD_MEMBERS,
    Permission.CONVERSATION_REMOVE_MEMBERS,
    Permission.CONVERSATION_PIN_MESSAGE,
    Permission.MESSAGE_SEND,
    Permission.MESSAGE_EDIT_SELF,
    Permission.MESSAGE_DELETE_SELF,
    Permission.MESSAGE_SEARCH,
    Permission.ANNOUNCEMENT_PUBLISH_CLASS,
    Permission.ANNOUNCEMENT_PUBLISH_STREAM,
    Permission.ANNOUNCEMENT_DELETE,
    Permission.REPORT_CREATE,
  ],
  [RoleName.HEADTEACHER]: [
    Permission.USER_READ_SELF,
    Permission.USER_UPDATE_SELF,
    Permission.USER_READ_STUDENTS,
    Permission.USER_READ_STAFF,
    Permission.USER_EXPORT_CSV,
    Permission.CONVERSATION_CREATE_PRIVATE,
    Permission.CONVERSATION_CREATE_GROUP,
    Permission.CONVERSATION_MANAGE_GROUP,
    Permission.CONVERSATION_ADD_MEMBERS,
    Permission.CONVERSATION_REMOVE_MEMBERS,
    Permission.CONVERSATION_PIN_MESSAGE,
    Permission.MESSAGE_SEND,
    Permission.MESSAGE_EDIT_SELF,
    Permission.MESSAGE_DELETE_SELF,
    Permission.MESSAGE_SEARCH,
    Permission.ANNOUNCEMENT_PUBLISH_CLASS,
    Permission.ANNOUNCEMENT_PUBLISH_STREAM,
    Permission.ANNOUNCEMENT_PUBLISH_STAFF,
    Permission.ANNOUNCEMENT_PUBLISH_SCHOOL,
    Permission.ANNOUNCEMENT_PUBLISH_ADMIN,
    Permission.ANNOUNCEMENT_DELETE,
    Permission.REPORT_CREATE,
  ],
  [RoleName.DEPUTY_HEADTEACHER]: [
    Permission.USER_READ_SELF,
    Permission.USER_UPDATE_SELF,
    Permission.USER_READ_STUDENTS,
    Permission.USER_READ_STAFF,
    Permission.CONVERSATION_CREATE_PRIVATE,
    Permission.MESSAGE_SEND,
    Permission.MESSAGE_EDIT_SELF,
    Permission.MESSAGE_DELETE_SELF,
    Permission.MESSAGE_SEARCH,
    Permission.ANNOUNCEMENT_PUBLISH_CLASS,
    Permission.ANNOUNCEMENT_PUBLISH_STREAM,
    Permission.ANNOUNCEMENT_PUBLISH_STAFF,
    Permission.ANNOUNCEMENT_PUBLISH_ADMIN,
    Permission.ANNOUNCEMENT_DELETE,
    Permission.REPORT_CREATE,
  ],
  [RoleName.SCHOOL_ADMINISTRATOR]: [
    Permission.USER_READ_SELF,
    Permission.USER_UPDATE_SELF,
    Permission.USER_READ_STUDENTS,
    Permission.USER_READ_STAFF,
    Permission.USER_CREATE,
    Permission.USER_UPDATE_OTHERS,
    Permission.USER_SUSPEND,
    Permission.USER_RESTORE,
    Permission.USER_RESET_PASSWORD,
    Permission.USER_IMPORT_CSV,
    Permission.USER_EXPORT_CSV,
    Permission.CLASS_MANAGE,
    Permission.SUBJECT_MANAGE,
    Permission.ENROLMENT_MANAGE,
    Permission.CONVERSATION_CREATE_GROUP,
    Permission.CONVERSATION_MANAGE_GROUP,
    Permission.CONVERSATION_ADD_MEMBERS,
    Permission.CONVERSATION_REMOVE_MEMBERS,
    Permission.CONVERSATION_PIN_MESSAGE,
    Permission.MESSAGE_SEND,
    Permission.MESSAGE_EDIT_SELF,
    Permission.MESSAGE_DELETE_SELF,
    Permission.ANNOUNCEMENT_PUBLISH_ADMIN,
    Permission.ANNOUNCEMENT_DELETE,
    Permission.REPORT_CREATE,
  ],
  [RoleName.ICT_ADMINISTRATOR]: [
    Permission.USER_READ_SELF,
    Permission.USER_UPDATE_SELF,
    Permission.SYSTEM_SETTINGS,
    Permission.SYSTEM_AUDIT_READ,
    Permission.SYSTEM_BACKUP_MANAGE,
    Permission.SYSTEM_DB_MAINTAIN,
    Permission.SYSTEM_DEPLOY,
    Permission.REPORT_CREATE,
  ],
  [RoleName.SCHOOL_SECRETARY]: [
    Permission.USER_READ_SELF,
    Permission.USER_UPDATE_SELF,
    Permission.CONVERSATION_CREATE_PRIVATE,
    Permission.CONVERSATION_CREATE_GROUP,
    Permission.CONVERSATION_MANAGE_GROUP,
    Permission.CONVERSATION_ADD_MEMBERS,
    Permission.CONVERSATION_REMOVE_MEMBERS,
    Permission.CONVERSATION_PIN_MESSAGE,
    Permission.MESSAGE_SEND,
    Permission.MESSAGE_EDIT_SELF,
    Permission.MESSAGE_DELETE_SELF,
    Permission.MESSAGE_SEARCH,
    Permission.ANNOUNCEMENT_PUBLISH_ADMIN,
    Permission.ANNOUNCEMENT_DELETE,
    Permission.REPORT_CREATE,
  ],
  [RoleName.PARENT_GUARDIAN]: [
    Permission.USER_READ_SELF,
    Permission.USER_UPDATE_SELF,
    Permission.CONVERSATION_CREATE_PRIVATE,
    Permission.MESSAGE_SEND,
    Permission.MESSAGE_EDIT_SELF,
    Permission.MESSAGE_DELETE_SELF,
    Permission.MESSAGE_SEARCH,
    Permission.REPORT_CREATE,
  ],
};

// ---------------------------------------------------------------------------
// Account status
// ---------------------------------------------------------------------------

export enum AccountStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  DELETED = 'DELETED',
}

// ---------------------------------------------------------------------------
// User DTOs
// ---------------------------------------------------------------------------

export interface UserSummaryDto {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  roles: RoleName[];
  status: AccountStatus;
}

export interface UserProfileDto extends UserSummaryDto {
  createdAt: string;
  admissionNo?: string | null;
  staffNo?: string | null;
  department?: string | null;
  className?: string | null;
  streamName?: string | null;
}

// ---------------------------------------------------------------------------
// Auth DTOs
// ---------------------------------------------------------------------------

export interface RegisterStudentDto {
  admissionNo: string;
  fullName: string;
  email?: string;
  phone?: string;
  password: string;
  classId: string;
  streamId: string;
}

export interface RegisterStaffDto {
  staffNo: string;
  fullName: string;
  email?: string;
  phone?: string;
  password: string;
  department?: string;
  role: RoleName;
}

export interface LoginDto {
  identifier: string;
  password: string;
  deviceId?: string;
}

export interface AuthTokensDto {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthResponseDto {
  user: UserProfileDto;
  tokens: AuthTokensDto;
}

export interface RefreshDto {
  refreshToken: string;
}

// ---------------------------------------------------------------------------
// Messaging — DTOs
// ---------------------------------------------------------------------------

export interface ConversationParticipantDto {
  userId: string;
  fullName: string;
  role: 'MEMBER' | 'ADMIN';
  joinedAt: string;
}

export interface ConversationDto {
  id: string;
  type: 'PRIVATE' | 'GROUP';
  title: string | null;        // for PRIVATE: the other party's name; for GROUP: the group name
  groupId: string | null;
  participants: ConversationParticipantDto[];
  lastMessage: MessageDto | null;
  lastReadMessageId: string | null;  // the caller's last-read watermark
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationListItemDto {
  id: string;
  type: 'PRIVATE' | 'GROUP';
  title: string | null;
  lastMessagePreview: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
  updatedAt: string;
}

export interface MessageAttachmentDto {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  // signedUrl is null if the caller cannot access the attachment
  signedUrl: string | null;
}

export interface MessageReactionDto {
  emoji: string;
  userId: string;
  fullName: string;
}

export interface MessageDto {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  clientMessageId: string;
  type: 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'VOICE' | 'DOCUMENT' | 'SYSTEM';
  body: string | null;
  replyTo: {
    id: string;
    senderName: string;
    bodyPreview: string;
  } | null;
  reactions: MessageReactionDto[];
  attachments: MessageAttachmentDto[];
  editedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  // delivery state from the perspective of the caller (null for the sender)
  myDeliveryState: 'SENT' | 'DELIVERED' | 'READ' | null;
}

// ---------------------------------------------------------------------------
// Messaging — WebSocket event contracts
// ---------------------------------------------------------------------------

/**
 * Events the client sends to the server (client → server).
 */
export enum WsClientEvent {
  JOIN_CONVERSATION = 'conversation.join',
  LEAVE_CONVERSATION = 'conversation.leave',
  SEND_MESSAGE = 'message.send',
  EDIT_MESSAGE = 'message.edit',
  DELETE_MESSAGE = 'message.delete',
  TYPING_START = 'typing.start',
  TYPING_STOP = 'typing.stop',
  MARK_READ = 'message.read',
  REACT = 'message.react',
  UNREACT = 'message.unreact',
}

/**
 * Events the server sends to the client (server → client).
 */
export enum WsServerEvent {
  MESSAGE_NEW = 'message.new',
  MESSAGE_EDITED = 'message.edited',
  MESSAGE_DELETED = 'message.deleted',
  MESSAGE_REACTION_ADDED = 'message.reaction.added',
  MESSAGE_REACTION_REMOVED = 'message.reaction.removed',
  TYPING_UPDATE = 'typing.update',
  READ_RECEIPT = 'message.read_receipt',
  DELIVERY_UPDATE = 'message.delivery',
  ERROR = 'error',
  AUTHORIZED = 'authorized',
}

export interface WsSendMessagePayload {
  conversationId: string;
  clientMessageId: string;
  type?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'VOICE' | 'DOCUMENT';
  body?: string;
  replyToId?: string;
  assetIds?: string[];
}

export interface WsEditMessagePayload {
  messageId: string;
  body: string;
}

export interface WsReactPayload {
  messageId: string;
  emoji: string;
}

export interface WsTypingPayload {
  conversationId: string;
}

export interface WsMarkReadPayload {
  conversationId: string;
  lastReadMessageId: string;
}

export interface WsAuthorizedPayload {
  userId: string;
}

export interface WsErrorPayload {
  code: string;
  message: string;
}

// Media DTOs
export type MediaCategory = 'image' | 'document' | 'voice' | 'video' | 'audio';

export interface MediaAssetDto {
  id: string;
  ownerId: string;
  category: MediaCategory;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
  widthPx: number | null;
  heightPx: number | null;
  durationSec: number | null;
  signedUrl: string | null;
  signedUrlTtlSec: number;
  createdAt: string;
}

// Notifications DTOs
export type NotificationType =
  | 'message.new' | 'announcement.new' | 'announcement.ack'
  | 'report.status' | 'account.approved' | 'account.suspended' | 'system';

export interface NotificationDto {
  id: string;
  type: NotificationType;
  payload: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationPreferencesDto {
  enabled: boolean;
  perType: Record<string, { inApp: boolean; push: boolean }>;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
}

// ---------------------------------------------------------------------------
// Announcements — DTOs
// ---------------------------------------------------------------------------

export interface AnnouncementDto {
  id: string;
  authorId: string;
  authorName: string;
  category: string;
  priority: string;
  audience: string;
  title: string;
  body: string;
  publishedAt: string;
  expiresAt: string | null;
  targetClassId: string | null;
  targetStreamId: string | null;
  targetClassName: string | null;
  targetStreamName: string | null;
  acknowledged: boolean;
  acknowledgementCount: number;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Groups — DTOs
// ---------------------------------------------------------------------------

export interface GroupMemberDto {
  userId: string;
  fullName: string;
  role: 'MEMBER' | 'ADMIN';
  addedAt: string;
}

export interface GroupDto {
  id: string;
  type: string;
  name: string;
  description: string | null;
  conversationId: string | null;
  createdBy: string;
  createdAt: string;
  memberCount: number;
  members?: GroupMemberDto[];
}

// ---------------------------------------------------------------------------
// Dashboard — DTOs
// ---------------------------------------------------------------------------

export interface DashboardStatsDto {
  totalStudents: number;
  totalTeachers: number;
  totalActiveAccounts: number;
  totalSuspended: number;
  totalPending: number;
  totalGroups: number;
  totalConversations: number;
  totalAnnouncements: number;
  recentAnnouncements: { id: string; title: string; authorName: string; publishedAt: string }[];
  recentActivity: { action: string; actorName: string; at: string }[];
}
