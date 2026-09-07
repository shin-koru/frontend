import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';

import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { ToastService } from '../services/toast.service';

const errorMessages: Record<number, string> = {
  400: 'Некорректный запрос',
  401: 'Необходимо авторизоваться',
  403: 'Недостаточно прав',
  404: 'Ресурс не найден',
  409: 'Конфликт данных',
  500: 'Ошибка сервера',
};

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const toastService = inject(ToastService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      const message = error.error?.message ?? errorMessages[error.status];

      toastService.showErrorToast(message);

      return throwError(() => error);
    }),
  );
};
