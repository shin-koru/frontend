import { Injectable, inject, signal, effect, DestroyRef, untracked } from '@angular/core';
import { Subscription } from 'rxjs';
import { SessionService } from '../../../core/services/session.service';
import { SubscriptionApi } from '../service/subscription.api';
import { CurrentSubscription, Plan } from '../model/subscription.model';
@Injectable()
export class SubscriptionStore {
  private readonly api = inject(SubscriptionApi);
  private readonly session = inject(SessionService);
  private requests = new Subscription();
  private retryKey?: { code: string; id: string };
  readonly plans = signal<Plan[]>([]);
  readonly total = signal(0);
  readonly loadingPlans = signal(false);
  readonly plansError = signal(false);
  readonly current = signal<CurrentSubscription>({ subscription: null, plan: null });
  readonly loadingCurrent = signal(false);
  readonly currentError = signal(false);
  readonly busy = signal(false);
  readonly message = signal('');
  readonly actionError = signal('');
  constructor() {
    inject(DestroyRef).onDestroy(() => this.requests.unsubscribe());
    effect(() => {
      const token = this.session.token();
      untracked(() => {
        this.requests.unsubscribe();
        this.requests = new Subscription();
        this.retryKey = undefined;
        this.plans.set([]);
        this.total.set(0);
        this.current.set({ subscription: null, plan: null });
        this.busy.set(false);
        this.message.set('');
        this.actionError.set('');
        this.plansError.set(false);
        this.currentError.set(false);
        this.loadingPlans.set(false);
        this.loadingCurrent.set(false);
        if (token) {
          this.loadPlans();
          this.refreshCurrent();
        }
      });
    });
  }
  loadPlans(): void {
    if (this.loadingPlans() || !this.session.token()) return;
    this.loadingPlans.set(true);
    this.plansError.set(false);
    this.requests.add(
      this.api.plans(this.plans().length).subscribe({
        next: (page) => {
          this.plans.update((items) => [...items, ...(page.items ?? [])]);
          this.total.set(page.total ?? 0);
          this.loadingPlans.set(false);
        },
        error: () => {
          this.plansError.set(true);
          this.loadingPlans.set(false);
        },
      }),
    );
  }
  refreshCurrent(): void {
    if (this.loadingCurrent() || !this.session.token()) return;
    this.loadingCurrent.set(true);
    this.currentError.set(false);
    this.requests.add(
      this.api.current().subscribe({
        next: (value) => {
          this.current.set(value);
          this.loadingCurrent.set(false);
        },
        error: () => {
          this.currentError.set(true);
          this.loadingCurrent.set(false);
        },
      }),
    );
  }
  redeem(value: string): void {
    if (this.busy() || this.loadingCurrent() || this.currentError() || !this.session.token())
      return;
    const code = value.trim().toUpperCase();
    if (!/^[A-F0-9]{32}$/.test(code)) {
      this.actionError.set('Enter the 32-character promo code you received.');
      return;
    }
    if (this.retryKey?.code !== code) this.retryKey = { code, id: crypto.randomUUID() };
    this.busy.set(true);
    this.actionError.set('');
    this.message.set('');
    this.requests.add(
      this.api.redeem(code, this.retryKey.id).subscribe({
        next: (subscription) => {
          this.busy.set(false);
          this.current.set({ subscription, plan: null });
          this.message.set(
            subscription.status === 'ACTIVE'
              ? 'Your subscription is active.'
              : 'This code was already redeemed. Your subscription status has been refreshed.',
          );
          this.refreshCurrent();
        },
        error: (error) => {
          this.busy.set(false);
          this.actionError.set(this.errorMessage(error));
        },
      }),
    );
  }
  cancel(): void {
    const subscription = this.current().subscription;
    if (!subscription || this.busy() || !this.session.token()) return;
    this.busy.set(true);
    this.actionError.set('');
    this.message.set('');
    this.requests.add(
      this.api.cancel(subscription.id).subscribe({
        next: () => {
          this.busy.set(false);
          this.current.set({ subscription: null, plan: null });
          this.message.set('Your subscription has been canceled. Access ended immediately.');
        },
        error: (error) => {
          this.busy.set(false);
          this.actionError.set(this.errorMessage(error));
        },
      }),
    );
  }
  private errorMessage(error: { status?: number; error?: { message?: unknown } }): string {
    if (
      error.status &&
      error.status >= 400 &&
      error.status < 500 &&
      typeof error.error?.message === 'string'
    )
      return error.error.message;
    return 'We could not complete the request. Please retry; a retry will not redeem your code twice.';
  }
}
