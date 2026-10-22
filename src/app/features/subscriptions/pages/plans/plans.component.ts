import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonDirective } from '../../../../shared/ui/button.directive';
import { SubscriptionStore } from '../../state/subscription.store';
import { formatPlanPrice } from '../../model/subscription.model';
@Component({
  imports: [DatePipe, FormsModule, ButtonDirective],
  providers: [SubscriptionStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './plans.component.html',
  styleUrl: './plans.component.css',
})
export class PlansComponent {
  readonly subscriptions = inject(SubscriptionStore);
  readonly code = signal('');
  readonly confirmCancel = signal(false);
  readonly price = formatPlanPrice;
}
