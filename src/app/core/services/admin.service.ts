import { HttpClient, HttpContext } from '@angular/common/http';
import { effect, inject, Injectable, signal } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of, tap } from 'rxjs';
import { SessionService } from './session.service';
import { SILENT_HTTP_ERROR } from '../interceptors/http-context';

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly http = inject(HttpClient);
  private readonly session = inject(SessionService);
  readonly isAdmin = signal(false);
  constructor() {
    effect((onCleanup) => {
      const token = this.session.token();
      this.isAdmin.set(false);
      if (token) {
        const sub = this.check().subscribe();
        onCleanup(() => sub.unsubscribe());
      }
    });
  }
  check() {
    return this.http
      .get<{ role: string }>('/api/auth/me', {
        context: new HttpContext().set(SILENT_HTTP_ERROR, true),
      })
      .pipe(
        map((user) => user.role === 'ADMIN'),
        catchError(() => of(false)),
        tap((admin) => this.isAdmin.set(admin)),
      );
  }
}
export const adminGuard: CanActivateFn = () => {
  const router = inject(Router);
  return inject(AdminService)
    .check()
    .pipe(map((admin) => admin || router.createUrlTree(['/profile'])));
};
