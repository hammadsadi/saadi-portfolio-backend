import type { UserRole, IUserDocument } from '../user/user.types.js';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AccessTokenPayload {
  userId: string;
  role: UserRole;
}

export interface OAuthUserInfo {
  provider: 'google' | 'github';
  providerId: string;
  email: string;
  name: string;
  avatar: string | null;
}

export interface AuthResult {
  user: IUserDocument;
  tokens: TokenPair;
}
