import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PaymentHistoryStore } from '../../state/payment-history.store';
@Component({
  selector: 'shin-payment-history',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe, DatePipe, RouterLink],
  providers: [PaymentHistoryStore],
  templateUrl: './payment-history.component.html',
  styleUrl: './payment-history.component.css',
})
export class PaymentHistoryComponent {
  readonly admin = inject(ActivatedRoute).snapshot.data['admin'] === true;
  readonly history = inject(PaymentHistoryStore);
  readonly statuses = ['CREATING', 'PENDING', 'CONFIRMED', 'PAID', 'FAILED', 'EXPIRED', 'REVIEW'];
  constructor() {
    this.history.configure(this.admin);
  }
  label(status: string) {
    return (
      (
        {
          CREATING: 'Creating checkout',
          PENDING: 'Awaiting payment',
          CONFIRMED: 'Activating subscription',
          PAID: 'Paid',
          FAILED: 'Failed',
          EXPIRED: 'Expired',
          REVIEW: 'Needs review',
        } as Record<string, string>
      )[status] ?? status
    );
  }
}
