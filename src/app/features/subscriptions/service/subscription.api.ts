import { Plan, UserSubscription, CurrentSubscription } from '../model/subscription.model';
import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { SILENT_HTTP_ERROR } from '../../../core/interceptors/http-context';
@Injectable({ providedIn: 'root' })
export class SubscriptionApi {
  private readonly http = inject(HttpClient);
  private options() {
    return { context: new HttpContext().set(SILENT_HTTP_ERROR, true) };
  }
  plans(offset = 0) {
    return this.http.get<{ items: Plan[]; total: number }>('/api/plans', {
      ...this.options(),
      params: { limit: 20, offset },
    });
  }
  current() {
    return this.http.get<CurrentSubscription>('/api/subscriptions/me', this.options());
  }
  redeem(code: string, requestId: string) {
    return this.http.post<UserSubscription>(
      '/api/subscriptions/promo',
      { code, requestId },
      this.options(),
    );
  }
  cancel(id: string) {
    return this.http.post<UserSubscription>(
      `/api/subscriptions/${encodeURIComponent(id)}/cancel`,
      {},
      this.options(),
    );
  }
}
