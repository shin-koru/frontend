import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { AdminUser, AdminUserFilter, AdminUserPage, UserRole } from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class UsersApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/admin/users';

  list(filter: AdminUserFilter, limit: number, offset: number) {
    let params = new HttpParams().set('limit', limit).set('offset', offset);
    if (filter.search.trim()) params = params.set('search', filter.search.trim());
    if (filter.role) params = params.set('role', filter.role);
    if (filter.blocked) params = params.set('blocked', filter.blocked);
    return this.http.get<AdminUserPage>(this.baseUrl, { params });
  }

  get(id: string) {
    return this.http.get<AdminUser>(`${this.baseUrl}/${encodeURIComponent(id)}`);
  }

  setRole(id: string, role: UserRole) {
    return this.http.patch<AdminUser>(`${this.baseUrl}/${encodeURIComponent(id)}/role`, { role });
  }

  setBlocked(id: string, blocked: boolean) {
    return this.http.post<AdminUser>(
      `${this.baseUrl}/${encodeURIComponent(id)}/${blocked ? 'block' : 'unblock'}`,
      {},
    );
  }
}
