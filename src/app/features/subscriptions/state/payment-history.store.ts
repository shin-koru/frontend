import { DestroyRef, Injectable, effect, inject, signal, untracked } from '@angular/core';
import { Subscription } from 'rxjs';
import { SessionService } from '../../../core/services/session.service';
import { PaymentApi } from '../service/payment.api';
import { PaymentOrder } from '../model/payment.model';
@Injectable()
export class PaymentHistoryStore {
  private readonly api = inject(PaymentApi);
  private readonly session = inject(SessionService);
  private request?: Subscription;
  private admin = false;
  readonly items = signal<PaymentOrder[]>([]);
  readonly total = signal(0);
  readonly offset = signal(0);
  readonly status = signal('');
  readonly userId = signal('');
  readonly loading = signal(false);
  readonly error = signal('');
  constructor() {
    inject(DestroyRef).onDestroy(() => this.request?.unsubscribe());
    effect(() => {
      const token = this.session.token();
      untracked(() => {
        this.request?.unsubscribe();
        this.items.set([]);
        this.total.set(0);
        this.loading.set(false);
        if (token) this.load(0);
      });
    });
  }
  configure(admin: boolean) {
    this.admin = admin;
  }
  filter(status: string, userId: string) {
    this.status.set(status);
    this.userId.set(userId.trim());
    this.load(0);
  }
  load(offset = this.offset()) {
    this.request?.unsubscribe();
    this.items.set([]);
    this.error.set('');
    this.offset.set(offset);
    if (!this.session.token()) return;
    this.loading.set(true);
    this.request = this.api.history(this.admin, offset, this.status(), this.userId()).subscribe({
      next: (page) => {
        this.items.set(page.items);
        this.total.set(page.total);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('Could not load payments. Check the filters and try again.');
      },
    });
  }
}
