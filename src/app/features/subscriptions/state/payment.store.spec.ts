import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Router } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { SessionService } from '../../../core/services/session.service';
import { PaymentStore } from './payment.store';
import { PaymentOrder, trustedCheckoutUrl } from '../model/payment.model';
describe('Study checkout state', () => {
  const token = signal<string | null>('session');
  const id = 'b967f773-1867-4807-83be-a2f60bc4e211';
  let store: PaymentStore, http: HttpTestingController;
  const router = { navigate: vi.fn() };
  beforeEach(() => {
    token.set('session');
    router.navigate.mockReset();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        PaymentStore,
        { provide: SessionService, useValue: { token } },
        { provide: Router, useValue: router },
      ],
    });
    store = TestBed.inject(PaymentStore);
    http = TestBed.inject(HttpTestingController);
    TestBed.tick();
    http.expectOne('/api/payments/options').flush({ enabled: true, mode: 'demo', currency: 'KZT' });
  });
  afterEach(() => http.verify());
  it('reuses the checkout key after network failure and never sends prices or users', () => {
    store.create(id);
    const first = http.expectOne('/api/payments/checkout');
    const requestId = first.request.body.requestId;
    expect(first.request.body).toEqual({ planId: id, requestId });
    store.create(id);
    http.expectNone('/api/payments/checkout');
    first.flush({}, { status: 503, statusText: 'Unavailable' });
    store.create(id);
    const second = http.expectOne('/api/payments/checkout');
    expect(second.request.body.requestId).toBe(requestId);
    second.flush({ id, status: 'PENDING' });
    expect(router.navigate).toHaveBeenCalledWith(['/plans/payment', id]);
  });
  it('does not trust return query parameters or assume payment success', () => {
    store.paymentId.set(id);
    TestBed.tick();
    http.expectOne('/api/payments/options').flush({ enabled: true, mode: 'demo', currency: 'KZT' });
    http.expectOne('/api/payments/' + id).flush({ id, mode: 'demo', status: 'PENDING' });
    expect(store.order()?.status).toBe('PENDING');
    store.completeDemo(true);
    const req = http.expectOne('/api/payments/' + id + '/demo');
    expect(req.request.body).toEqual({ success: true });
    req.flush({ id, mode: 'demo', status: 'PAID' });
    expect(store.order()?.status).toBe('PAID');
    store.completeDemo(true);
    http.expectNone('/api/payments/' + id + '/demo');
  });
  it('never simulates provider test orders', () => {
    store.order.set({ id, mode: 'freedompay_test', status: 'PENDING' } as PaymentOrder);
    store.completeDemo(true);
    http.expectNone('/api/payments/' + id + '/demo');
  });
  it('cancels pending work on logout', () => {
    store.create(id);
    const req = http.expectOne('/api/payments/checkout');
    token.set(null);
    TestBed.tick();
    expect(req.cancelled).toBe(true);
    expect(store.order()).toBeNull();
    expect(store.options()).toBeNull();
  });
  it('blocks untrusted redirects', () => {
    expect(trustedCheckoutUrl('https://customer.freedompay.kz/pay.html')).toBeTruthy();
    expect(trustedCheckoutUrl('https://customer.freedompay.kz.evil.test')).toBeNull();
    expect(trustedCheckoutUrl('javascript:alert(1)')).toBeNull();
  });
});
