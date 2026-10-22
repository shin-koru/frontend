import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { beforeEach, afterEach, describe, it, expect } from 'vitest';
import { SessionService } from '../../../core/services/session.service';
import { SubscriptionStore } from './subscription.store';
import { formatPlanPrice } from '../model/subscription.model';

describe('Subscription page state', () => {
  const token = signal<string | null>('session');
  let store: SubscriptionStore;
  let http: HttpTestingController;
  const id = 'b967f773-1867-4807-83be-a2f60bc4e211';
  beforeEach(() => {
    token.set('session');
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        SubscriptionStore,
        { provide: SessionService, useValue: { token } },
      ],
    });
    store = TestBed.inject(SubscriptionStore);
    http = TestBed.inject(HttpTestingController);
    TestBed.tick();
    http.expectOne('/api/plans?limit=20&offset=0').flush({ items: [], total: 0 });
    http.expectOne('/api/subscriptions/me').flush({ subscription: null, plan: null });
    TestBed.tick();
  });
  afterEach(() => http.verify());
  it('does not reload when async loading flags change', () => {
    expect(store.loadingCurrent()).toBe(false);
    expect(store.loadingPlans()).toBe(false);
    http.expectNone('/api/subscriptions/me');
  });
  it('keeps the same idempotency key for retries and sends no user ID', () => {
    store.redeem('a'.repeat(32));
    const first = http.expectOne('/api/subscriptions/promo');
    const key = first.request.body.requestId;
    expect(first.request.body).toEqual({ code: 'A'.repeat(32), requestId: key });
    first.flush({}, { status: 503, statusText: 'Unavailable' });
    store.redeem('A'.repeat(32));
    const retry = http.expectOne('/api/subscriptions/promo');
    expect(retry.request.body.requestId).toBe(key);
    retry.flush({ id, planId: id, status: 'ACTIVE', activationMethod: 'PROMO_CODE' });
    http
      .expectOne('/api/subscriptions/me')
      .flush({ subscription: { id, status: 'ACTIVE' }, plan: null });
    expect(store.current().subscription?.id).toBe(id);
  });
  it('does not submit invalid promo codes', () => {
    store.redeem('abc');
    expect(store.actionError()).toContain('32-character');
    http.expectNone('/api/subscriptions/promo');
  });
  it('cancels the owned subscription and clears it only on success', () => {
    store.current.set({
      subscription: {
        id,
        planId: id,
        status: 'ACTIVE',
        startedAt: '',
        expiresAt: '',
        activationMethod: 'PROMO_CODE',
      },
      plan: null,
    });
    store.cancel();
    const req = http.expectOne(`/api/subscriptions/${id}/cancel`);
    expect(req.request.body).toEqual({});
    req.flush({ id, status: 'CANCELED' });
    expect(store.current().subscription).toBeNull();
    expect(store.message()).toContain('canceled');
  });
  it('cancels in-flight requests and clears data on logout', () => {
    store.redeem('A'.repeat(32));
    const req = http.expectOne('/api/subscriptions/promo');
    token.set(null);
    TestBed.tick();
    expect(req.cancelled).toBe(true);
    expect(store.busy()).toBe(false);
    expect(store.current().subscription).toBeNull();
  });
  it('formats currencies using their minor unit precision', () => {
    const plan: any = { price: 999, currency: 'USD' };
    expect(formatPlanPrice(plan)).toBe('$9.99');
    expect(formatPlanPrice({ ...plan, currency: 'JPY' })).toContain('999');
  });
});
