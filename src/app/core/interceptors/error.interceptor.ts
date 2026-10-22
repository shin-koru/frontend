import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { ToastService } from '../services/toast.service';
import { SILENT_HTTP_ERROR } from './http-context';

export const errorInterceptor: HttpInterceptorFn = (request, next) => {
  const toast = inject(ToastService);
  return next(request).pipe(
    catchError((error: HttpErrorResponse) => {
      if (!request.context.get(SILENT_HTTP_ERROR)) {
        const value = error.error?.message;
        const message = Array.isArray(value)
          ? value.join(' ')
          : typeof value === 'string'
            ? value
            : error.status === 0
              ? 'Unable to reach SHIN. Please try again.'
              : 'The request could not be completed. Please try again.';
        toast.showErrorToast(message);
      }
      return throwError(() => error);
    }),
  );
};
