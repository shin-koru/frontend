import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ConfirmService } from '../../core/services/confirm.service';
import { ToastService } from '../../core/services/toast.service';
import { ButtonDirective } from './button.directive';
import { ModalComponent } from './modal.component';

@Component({
  selector: 'shin-notifications',
  imports: [ModalComponent, ButtonDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './notifications.component.html',
})
export class NotificationsComponent {
  private readonly toasts = inject(ToastService);
  private readonly confirmations = inject(ConfirmService);
  readonly notice = this.toasts.notice;
  readonly confirmation = this.confirmations.pending;
  dismiss(): void {
    this.toasts.clear();
  }
  accept(): void {
    this.confirmations.answer(true);
  }
  reject(): void {
    this.confirmations.answer(false);
  }
}
