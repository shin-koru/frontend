import { RouterLink } from '@angular/router';
import { PaymentStore } from '../../state/payment.store';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonDirective } from '../../../../shared/ui/button.directive';
import { SubscriptionStore } from '../../state/subscription.store';
import { formatPlanPrice } from '../../model/subscription.model';
@Component({
  imports: [RouterLink, DatePipe, FormsModule, ButtonDirective],
  providers: [SubscriptionStore, PaymentStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './plans.component.html',
  styleUrl: './plans.component.css',
})
export class PlansComponent {
  readonly payments = inject(PaymentStore);
  readonly subscriptions = inject(SubscriptionStore);
  readonly code = signal('');
  readonly confirmCancel = signal(false);
  readonly price = formatPlanPrice;
}
