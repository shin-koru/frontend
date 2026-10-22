import { DestroyRef, Injectable, effect, inject, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { SessionService } from '../../../core/services/session.service';
import { PaymentApi } from '../service/payment.api';
import { PaymentOptions, PaymentOrder } from '../model/payment.model';
@Injectable()
export class PaymentStore {
  private readonly api = inject(PaymentApi);
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);
  private requests = new Subscription();
  private retryKey?: { planId: string; requestId: string };
  readonly paymentId = signal<string | null>(null);
  readonly options = signal<PaymentOptions | null>(null);
  readonly optionsError = signal(false);
  readonly order = signal<PaymentOrder | null>(null);
  readonly busy = signal(false);
  readonly loading = signal(false);
  readonly error = signal('');
  constructor() {
    inject(DestroyRef).onDestroy(() => this.requests.unsubscribe());
    effect(() => {
      const token = this.session.token(),
        id = this.paymentId();
      untracked(() => {
        this.requests.unsubscribe();
        this.requests = new Subscription();
        this.retryKey = undefined;
        this.order.set(null);
        this.options.set(null);
        this.optionsError.set(false);
        this.error.set('');
        this.busy.set(false);
        this.loading.set(false);
        if (token) {
          this.loadOptions();
          if (id) this.refresh();
        }
      });
    });
  }
  loadOptions() {
    if (!this.session.token()) return;
    this.optionsError.set(false);
    this.requests.add(
      this.api.configuration().subscribe({
        next: (value) => this.options.set(value),
        error: () => this.optionsError.set(true),
      }),
    );
  }
  create(planId: string) {
    if (this.busy() || !this.options()?.enabled || !this.session.token()) return;
    if (this.retryKey?.planId !== planId)
      this.retryKey = { planId, requestId: crypto.randomUUID() };
    this.busy.set(true);
    this.error.set('');
    this.requests.add(
      this.api.create(planId, this.retryKey.requestId).subscribe({
        next: (order) => {
          this.busy.set(false);
          void this.router.navigate(['/plans/payment', order.id]);
        },
        error: (error) => {
          this.busy.set(false);
          this.error.set(this.message(error));
        },
      }),
    );
  }
  refresh() {
    const id = this.paymentId();
    if (!id || this.loading() || this.busy() || !this.session.token()) return;
    if (!/^[0-9a-f-]{36}$/i.test(id)) {
      this.error.set('Invalid payment link.');
      return;
    }
    this.loading.set(true);
    this.error.set('');
    this.requests.add(
      this.api.get(id).subscribe({
        next: (order) => {
          this.order.set(order);
          this.loading.set(false);
        },
        error: (error) => {
          this.loading.set(false);
          this.error.set(this.message(error));
        },
      }),
    );
  }
  completeDemo(success: boolean) {
    const order = this.order();
    if (
      !order ||
      order.mode !== 'demo' ||
      order.status !== 'PENDING' ||
      this.busy() ||
      this.loading() ||
      !this.options()?.enabled ||
      this.options()?.mode !== 'demo' ||
      !this.session.token()
    )
      return;
    this.busy.set(true);
    this.error.set('');
    this.requests.add(
      this.api.completeDemo(order.id, success).subscribe({
        next: (value) => {
          this.order.set(value);
          this.busy.set(false);
        },
        error: (error) => {
          this.busy.set(false);
          this.error.set(this.message(error));
        },
      }),
    );
  }
  private message(error: { status?: number; error?: { message?: unknown } }) {
    if (
      error.status &&
      error.status >= 400 &&
      error.status < 500 &&
      typeof error.error?.message === 'string'
    )
      return error.error.message;
    return 'We could not confirm the request. Check the payment status or retry with the same checkout.';
  }
}
