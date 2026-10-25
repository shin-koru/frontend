import { Injectable, signal } from '@angular/core';

export interface ConfirmRequest {
  message: string;
  header?: string;
  acceptLabel?: string;
  rejectLabel?: string;
}

interface PendingConfirm extends ConfirmRequest {
  resolve: (accepted: boolean) => void;
}

/** Asks the user to confirm an action; NotificationsComponent shows the dialog. */
@Injectable({
  providedIn: 'root',
})
export class ConfirmService {
  private readonly current = signal<PendingConfirm | null>(null);
  readonly pending = this.current.asReadonly();

  confirm(request: ConfirmRequest): Promise<boolean> {
    // A newer question replaces an unanswered one, which counts as cancelled.
    this.current()?.resolve(false);
    return new Promise<boolean>((resolve) => this.current.set({ ...request, resolve }));
  }

  answer(accepted: boolean): void {
    const pending = this.current();
    if (!pending) return;
    this.current.set(null);
    pending.resolve(accepted);
  }
}
