export interface OtpRequest {
  identifier: string;
  type: AuthIdentifierType;
  code: string | null;
}

export interface TokenResponse {
  accessToken: string;
}

export type AuthIdentifierType = 'phone' | 'email';
