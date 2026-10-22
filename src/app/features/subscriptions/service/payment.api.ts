import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { SILENT_HTTP_ERROR } from '../../../core/interceptors/http-context';
import { PaymentOptions, PaymentOrder, PaymentPage } from '../model/payment.model';
@Injectable({ providedIn: 'root' })
export class PaymentApi {
  private readonly http = inject(HttpClient);
  private options() {
    return { context: new HttpContext().set(SILENT_HTTP_ERROR, true) };
  }
  history(admin: boolean, offset: number, status: string, userId: string) {
    return this.http.get<PaymentPage>(admin ? '/api/admin/payments' : '/api/payments/me', {
      ...this.options(),
      params: {
        limit: 20,
        offset,
        ...(status ? { status } : {}),
        ...(admin && userId ? { userId } : {}),
      },
    });
  }
  configuration() {
    return this.http.get<PaymentOptions>('/api/payments/options', this.options());
  }
  create(planId: string, requestId: string) {
    return this.http.post<PaymentOrder>(
      '/api/payments/checkout',
      { planId, requestId },
      this.options(),
    );
  }
  get(id: string) {
    return this.http.get<PaymentOrder>(`/api/payments/${encodeURIComponent(id)}`, this.options());
  }
  completeDemo(id: string, success: boolean) {
    return this.http.post<PaymentOrder>(
      `/api/payments/${encodeURIComponent(id)}/demo`,
      { success },
      this.options(),
    );
  }
}
