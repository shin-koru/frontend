import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PaymentStore } from '../../state/payment.store';
import { trustedCheckoutUrl } from '../../model/payment.model';
import { ButtonDirective } from '../../../../shared/ui/button.directive';
@Component({
  imports: [DatePipe, RouterLink, ButtonDirective],
  providers: [PaymentStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './payment.component.html',
  styleUrl: './payment.component.css',
})
export class PaymentComponent {
  readonly payments = inject(PaymentStore);
  readonly checkoutUrl = trustedCheckoutUrl;
  constructor() {
    inject(ActivatedRoute)
      .paramMap.pipe(takeUntilDestroyed())
      .subscribe((params) => this.payments.paymentId.set(params.get('id')));
  }
  amount(value: number) {
    return new Intl.NumberFormat('en', { style: 'currency', currency: 'KZT' }).format(value / 100);
  }
}
