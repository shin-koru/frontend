import { ErrorHandler, inject, Injectable } from '@angular/core';
import { ToastService } from '../services/toast.service';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  private readonly toastService = inject(ToastService);

  handleError(error: any): void {
    let errorMessage = 'Unknown error occured';

    if (error instanceof Error) errorMessage = error.message;

    console.error('Error: ', errorMessage);
    this.toastService.showErrorToast(errorMessage);
  }
}
