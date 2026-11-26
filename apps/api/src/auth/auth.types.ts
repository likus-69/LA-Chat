import { RoleName, AccountStatus } from '@la-chat/shared-types';

/**
 * The shape of `req.user` after JwtStrategy validates the token.
 * Kept minimal so guards don't pull the whole user record.
 */
export interface AuthedUser {
  id: string;
  roles: RoleName[];
  status: AccountStatus;
  /** The refresh-token session this access token was issued for. */
  sessionId?: string;
}

export interface JwtPayload {
  sub: string; // user id
  roles: RoleName[];
  status: AccountStatus;
  sid?: string; // user_sessions.id
  iat?: number;
  exp?: number;
}
