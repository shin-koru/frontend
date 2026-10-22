import {
  PlanDraft,
  PromoDraft,
  PromoSummary,
  CreatedPromo,
  Page,
} from '../model/subscription-admin.model';
import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { SILENT_HTTP_ERROR } from '../../../core/interceptors/http-context';
import { Plan } from '../model/subscription.model';
@Injectable({ providedIn: 'root' })
export class SubscriptionAdminApi {
  private readonly http = inject(HttpClient);
  private options() {
    return { context: new HttpContext().set(SILENT_HTTP_ERROR, true) };
  }
  plans(offset: number) {
    return this.http.get<Page<Plan>>('/api/admin/plans', {
      ...this.options(),
      params: { limit: 20, offset },
    });
  }
  promos(offset: number) {
    return this.http.get<Page<PromoSummary>>('/api/admin/promo-codes', {
      ...this.options(),
      params: { limit: 20, offset },
    });
  }
  createPlan(draft: PlanDraft) {
    return this.http.post<Plan>('/api/admin/plans', draft, this.options());
  }
  setActive(id: string, isActive: boolean) {
    return this.http.patch<Plan>(
      `/api/admin/plans/${encodeURIComponent(id)}`,
      { isActive },
      this.options(),
    );
  }
  createPromo(draft: PromoDraft) {
    return this.http.post<CreatedPromo>('/api/admin/promo-codes', draft, this.options());
  }
  revoke(id: string) {
    return this.http.post<{ id: string }>(
      `/api/admin/promo-codes/${encodeURIComponent(id)}/revoke`,
      {},
      this.options(),
    );
  }
}
