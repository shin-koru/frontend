import { Injectable, signal } from '@angular/core';

export type ToastSeverity = 'success' | 'error' | 'warn' | 'info';

export interface Toast {
  severity: ToastSeverity;
  summary?: string;
  detail?: string;
}

/** One visible notification at a time; NotificationsComponent renders it. */
@Injectable({
  providedIn: 'root',
})
export class ToastService {
  private readonly current = signal<Toast | null>(null);
  readonly notice = this.current.asReadonly();

  public showToast(severity: ToastSeverity = 'info', summary?: string, detail?: string) {
    this.current.set({ severity, summary, detail });
  }

  public clear() {
    this.current.set(null);
  }

  public showSuccessToast(detail?: string) {
    this.showToast('success', 'Success', detail);
  }

  public showErrorToast(detail?: string) {
    this.showToast('error', 'Error', detail);
  }

  public showInfoToast(detail?: string) {
    this.showToast('info', 'Info', detail);
  }

  public showWarnToast(detail?: string) {
    this.showToast('warn', 'Warn', detail);
  }
}
