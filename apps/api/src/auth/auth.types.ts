import { RoleName, AccountStatus } from '@la-chat/shared-types';

/**
 * The shape of `req.user` after JwtStrategy validates the token.
 * Kept minimal so guards don't pull the whole user record.
 */
export interface AuthedUser {
  id: string;
  roles: RoleName[];
  status: AccountStatus;
}

export interface JwtPayload {
  sub: string; // user id
  roles: RoleName[];
  status: AccountStatus;
  iat?: number;
  exp?: number;
}
