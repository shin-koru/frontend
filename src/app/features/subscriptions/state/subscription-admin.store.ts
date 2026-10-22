import { DestroyRef, Injectable, effect, inject, signal, untracked } from '@angular/core';
import { Observable, Subscription } from 'rxjs';
import { SessionService } from '../../../core/services/session.service';
import { Plan } from '../model/subscription.model';
import { SubscriptionAdminApi } from '../service/subscription-admin.api';
import {
  CreatedPromo,
  PlanDraft,
  PromoDraft,
  PromoSummary,
} from '../model/subscription-admin.model';
@Injectable()
export class SubscriptionAdminStore {
  private readonly api = inject(SubscriptionAdminApi);
  private readonly session = inject(SessionService);
  private requests = new Subscription();
  readonly plans = signal<Plan[]>([]);
  readonly promos = signal<PromoSummary[]>([]);
  readonly plansTotal = signal(0);
  readonly promosTotal = signal(0);
  readonly plansLoading = signal(false);
  readonly promosLoading = signal(false);
  readonly plansError = signal(false);
  readonly promosError = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly message = signal('');
  readonly created = signal<CreatedPromo | null>(null);
  constructor() {
    inject(DestroyRef).onDestroy(() => this.requests.unsubscribe());
    effect(() => {
      const token = this.session.token();
      untracked(() => {
        this.requests.unsubscribe();
        this.requests = new Subscription();
        this.plans.set([]);
        this.promos.set([]);
        this.plansTotal.set(0);
        this.promosTotal.set(0);
        this.plansLoading.set(false);
        this.promosLoading.set(false);
        this.plansError.set(false);
        this.promosError.set(false);
        this.busy.set(false);
        this.error.set('');
        this.message.set('');
        this.created.set(null);
        if (token) {
          this.loadPlans();
          this.loadPromos();
        }
      });
    });
  }
  loadPlans() {
    if (this.plansLoading() || !this.session.token()) return;
    this.plansLoading.set(true);
    this.plansError.set(false);
    this.requests.add(
      this.api.plans(this.plans().length).subscribe({
        next: (page) => {
          this.plans.update((items) => [...items, ...(page.items ?? [])]);
          this.plansTotal.set(page.total);
          this.plansLoading.set(false);
        },
        error: () => {
          this.plansError.set(true);
          this.plansLoading.set(false);
        },
      }),
    );
  }
  loadPromos() {
    if (this.promosLoading() || !this.session.token()) return;
    this.promosLoading.set(true);
    this.promosError.set(false);
    this.requests.add(
      this.api.promos(this.promos().length).subscribe({
        next: (page) => {
          this.promos.update((items) => [...items, ...(page.items ?? [])]);
          this.promosTotal.set(page.total);
          this.promosLoading.set(false);
        },
        error: () => {
          this.promosError.set(true);
          this.promosLoading.set(false);
        },
      }),
    );
  }
  private mutate<T>(request: Observable<T>, success: (value: T) => void) {
    if (this.busy() || !this.session.token()) return;
    this.busy.set(true);
    this.error.set('');
    this.message.set('');
    this.requests.add(
      request.subscribe({
        next: (value) => {
          this.busy.set(false);
          success(value);
        },
        error: () => {
          this.busy.set(false);
          this.error.set(
            'The operation could not be confirmed. Refresh the list before trying again.',
          );
        },
      }),
    );
  }
  createPlan(draft: PlanDraft) {
    this.mutate(this.api.createPlan(draft), () => {
      this.message.set('Plan created.');
      this.refreshPlans();
    });
  }
  setActive(plan: Plan) {
    this.mutate(this.api.setActive(plan.id, !plan.isActive), (updated) => {
      this.plans.update((items) => items.map((item) => (item.id === updated.id ? updated : item)));
      this.message.set(
        updated.isActive
          ? 'Plan activated.'
          : 'Plan deactivated. Existing subscriptions remain valid.',
      );
    });
  }
  createPromo(draft: PromoDraft) {
    if (this.created()) return;
    if (
      !Number.isFinite(Date.parse(draft.expiresAt)) ||
      Date.parse(draft.expiresAt) <= Date.now()
    ) {
      this.error.set('Choose an expiration date in the future.');
      return;
    }
    this.mutate(this.api.createPromo(draft), (result) => {
      this.created.set(result);
      this.message.set('Promo created. Save its code before closing this panel.');
      this.refreshPromos();
    });
  }
  revoke(id: string) {
    this.mutate(this.api.revoke(id), () => {
      this.promos.update((items) =>
        items.map((item) => (item.id === id ? { ...item, isActive: false } : item)),
      );
      this.message.set('Promo revoked. Existing subscriptions remain valid.');
    });
  }
  refreshPlans() {
    if (this.plansLoading()) return;
    this.plans.set([]);
    this.loadPlans();
  }
  refreshPromos() {
    if (this.promosLoading()) return;
    this.promos.set([]);
    this.loadPromos();
  }
}
