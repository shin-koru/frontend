import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { SessionService } from '../services/session.service';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  if (!request.url.startsWith('/api/')) return next(request);
  const session = inject(SessionService);
  const router = inject(Router);
  const authentication = /^\/api\/auth\/(?:otp\/(?:send|verify)|refresh|logout)(?:[?#]|$)/.test(
    request.url,
  );
  const send = (token: string | null) =>
    next(
      request.clone({
        withCredentials: true,
        ...(token && !authentication ? { setHeaders: { Authorization: `Bearer ${token}` } } : {}),
      }),
    );
  return send(session.token()).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status !== 401 || authentication) return throwError(() => error);
      return session.refresh().pipe(
        switchMap((token) => send(token)),
        catchError((failure: HttpErrorResponse) => {
          if (failure.status === 401 || failure.status === 403) {
            session.clear();
            void router.navigate(['/auth/login'], { queryParams: { returnUrl: router.url } });
          }
          return throwError(() => failure);
        }),
      );
    }),
  );
};
