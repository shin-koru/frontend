import { inject, Injectable } from '@angular/core';
import { MessageService } from 'primeng/api';

@Injectable({
  providedIn: 'root',
})
export class ToastService {
  private readonly messageService = inject(MessageService);

  public showToast(
    severity: 'success' | 'error' | 'warn' | 'info' = 'info',
    summary?: string,
    detail?: string,
    key: string = 'toast',
  ) {
    this.messageService.clear();
    this.messageService.add({ severity, summary, detail, key });
  }

  public showSuccessToast(detail?: string) {
    this.showToast('success', 'Success', detail);
  }

  public showErrorToast(detail?: string) {
    this.showToast('error', 'Error', detail);
  }
}
