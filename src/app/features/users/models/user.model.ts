export type UserRole = 'CLIENT' | 'ADMIN';

export interface AdminUser {
  id: string;
  email: string | null;
  phone: string | null;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  role: UserRole;
  isBlocked: boolean;
  blockedAt: string | null;
  createdAt: string | null;
}

export interface AdminUserPage {
  items: AdminUser[];
  total: number;
  limit: number;
  offset: number;
}

export interface AdminUserFilter {
  search: string;
  role: UserRole | '';
  blocked: 'true' | 'false' | '';
}

export const ROLE_LABELS: Record<UserRole, string> = {
  CLIENT: 'Viewer',
  ADMIN: 'Administrator',
};
