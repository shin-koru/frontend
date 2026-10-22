import { RouterLink } from '@angular/router';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonDirective } from '../../../../shared/ui/button.directive';
import { formatPlanPrice } from '../../model/subscription.model';
import { PlanDraft, PromoSummary } from '../../model/subscription-admin.model';
import { SubscriptionAdminStore } from '../../state/subscription-admin.store';
@Component({
  imports: [RouterLink, FormsModule, DatePipe, ButtonDirective],
  providers: [SubscriptionAdminStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './subscription-admin.component.html',
  styleUrl: './subscription-admin.component.css',
})
export class SubscriptionAdminComponent {
  readonly store = inject(SubscriptionAdminStore);
  readonly price = formatPlanPrice;
  readonly revokePending = signal<string | null>(null);
  readonly copied = signal(false);
  readonly copyError = signal(false);
  draft: PlanDraft = {
    name: '',
    price: 100000,
    currency: 'KZT',
    duration: 30,
    maxDevices: 1,
    maxQuality: 'HD',
    isActive: true,
  };
  promo = { planId: '', maxRedemptions: 1, expiresAt: '' };
  createPlan() {
    this.store.createPlan({
      ...this.draft,
      name: this.draft.name.trim(),
      currency: this.draft.currency.toUpperCase(),
    });
  }
  activePromoPlan() {
    return this.store.plans().some((plan) => plan.id === this.promo.planId && plan.isActive);
  }
  createPromo() {
    if (!this.activePromoPlan()) return;
    const date = new Date(this.promo.expiresAt);
    this.store.createPromo({
      ...this.promo,
      expiresAt: Number.isFinite(date.getTime()) ? date.toISOString() : '',
    });
  }
  status(promo: PromoSummary) {
    if (!promo.isActive) return 'Revoked';
    if (Date.parse(promo.expiresAt) <= Date.now()) return 'Expired';
    return promo.redemptionCount >= promo.maxRedemptions ? 'Fully used' : 'Available';
  }
  planName(id: string) {
    return this.store.plans().find((plan) => plan.id === id)?.name ?? id;
  }
  async copy() {
    this.copyError.set(false);
    try {
      await navigator.clipboard.writeText(this.store.created()?.code ?? '');
      this.copied.set(true);
    } catch {
      this.copyError.set(true);
    }
  }
  dismissCode() {
    this.store.created.set(null);
    this.copied.set(false);
    this.copyError.set(false);
  }
}
