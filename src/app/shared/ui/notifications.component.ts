import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ModalComponent } from './modal.component';
import { ButtonDirective } from './button.directive';

interface Notice {
  summary?: string;
  detail?: string;
  severity?: string;
}

@Component({
  selector: 'shin-notifications',
  imports: [ModalComponent, ButtonDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './notifications.component.html',
})
export class NotificationsComponent {
  private readonly messages = inject(MessageService);
  private readonly confirmations = inject(ConfirmationService);
  readonly notice = signal<Notice | null>(null);
  readonly confirmation = toSignal(this.confirmations.requireConfirmation$);
  constructor() {
    this.messages.messageObserver
      .pipe(takeUntilDestroyed())
      .subscribe((message) =>
        this.notice.set(Array.isArray(message) ? message[message.length - 1] : message),
      );
    this.messages.clearObserver.pipe(takeUntilDestroyed()).subscribe(() => this.notice.set(null));
  }
  accept(): void {
    this.confirmation()?.accept?.();
    this.confirmations.close();
  }
  reject(): void {
    this.confirmation()?.reject?.();
    this.confirmations.close();
  }
}
