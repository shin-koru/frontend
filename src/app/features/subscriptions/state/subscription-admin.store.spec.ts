import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { beforeEach, afterEach, describe, it, expect } from 'vitest';
import { SessionService } from '../../../core/services/session.service';
import { SubscriptionAdminStore } from './subscription-admin.store';
describe('Subscription admin state', () => {
  const token = signal<string | null>('session');
  let store: SubscriptionAdminStore;
  let http: HttpTestingController;
  const draft = { planId: 'plan', maxRedemptions: 5, expiresAt: '2030-01-01T00:00:00Z' };
  beforeEach(() => {
    token.set('session');
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        SubscriptionAdminStore,
        { provide: SessionService, useValue: { token } },
      ],
    });
    store = TestBed.inject(SubscriptionAdminStore);
    http = TestBed.inject(HttpTestingController);
    TestBed.tick();
    http.expectOne('/api/admin/plans?limit=20&offset=0').flush({ items: [], total: 0 });
    http.expectOne('/api/admin/promo-codes?limit=20&offset=0').flush({ items: [], total: 0 });
  });
  afterEach(() => http.verify());
  it('preserves the newly issued secret and prevents accidental overwrite', () => {
    store.createPromo(draft);
    store.createPromo(draft);
    const req = http.expectOne('/api/admin/promo-codes');
    expect(req.request.body).toEqual(draft);
    req.flush({ ...draft, id: 'promo', code: 'A'.repeat(32) });
    http.expectOne('/api/admin/promo-codes?limit=20&offset=0').flush({ items: [], total: 1 });
    store.createPromo(draft);
    http.expectNone('/api/admin/promo-codes');
    expect(store.created()?.code).toBe('A'.repeat(32));
    token.set(null);
    TestBed.tick();
    expect(store.created()).toBeNull();
    expect(store.promos()).toEqual([]);
  });
  it('rejects past dates before sending a request', () => {
    store.createPromo({ ...draft, expiresAt: '2000-01-01T00:00:00Z' });
    http.expectNone('/api/admin/promo-codes');
    expect(store.error()).toContain('future');
  });
  it('does not mark a promo revoked when the operation fails', () => {
    store.promos.set([
      { ...draft, id: 'promo', redemptionCount: 0, isActive: true, createdAt: '' },
    ]);
    store.revoke('promo');
    http
      .expectOne('/api/admin/promo-codes/promo/revoke')
      .flush({}, { status: 503, statusText: 'Unavailable' });
    expect(store.promos()[0].isActive).toBe(true);
    expect(store.busy()).toBe(false);
    store.revoke('promo');
    http.expectOne('/api/admin/promo-codes/promo/revoke').flush({ id: 'promo' });
    expect(store.promos()[0].isActive).toBe(false);
  });
  it('cancels in-flight work when the session changes', () => {
    store.loadPromos();
    const req = http.expectOne('/api/admin/promo-codes?limit=20&offset=0');
    token.set(null);
    TestBed.tick();
    expect(req.cancelled).toBe(true);
    expect(store.promosLoading()).toBe(false);
  });
});
