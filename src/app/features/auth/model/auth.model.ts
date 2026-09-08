export interface OtpRequest {
  identifier: string;
  type: 'phone' | 'email';
  code: string | null;
}

export interface TokenResponse {
  accessToken: string;
}
