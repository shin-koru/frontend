import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { StorageService } from '../services/storage.service';
import { catchError, throwError } from 'rxjs';
import { Router } from '@angular/router';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const storageService = inject(StorageService);
  const router = inject(Router)
  const token = storageService.getItem('token');

  if (token)
    req = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
      },
    });

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401) {
        storageService.removeItem('token')
        router.navigate(['/auth/login']);
      }
      return throwError(() => error);
    }),
  );
};
