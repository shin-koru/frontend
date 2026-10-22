import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { beforeEach, afterEach, describe, it, expect } from 'vitest';
import { SessionService } from '../../../core/services/session.service';
import { PaymentHistoryStore } from './payment-history.store';
describe('Payment history state', () => {
  const token = signal<string | null>('session');
  let store: PaymentHistoryStore, http: HttpTestingController;
  beforeEach(() => {
    token.set('session');
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        PaymentHistoryStore,
        { provide: SessionService, useValue: { token } },
      ],
    });
    store = TestBed.inject(PaymentHistoryStore);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it('loads owner history without sending a user ID', () => {
    TestBed.tick();
    const req = http.expectOne((r) => r.url === '/api/payments/me');
    expect(req.request.params.has('userId')).toBe(false);
    req.flush({ items: [{ id: 'payment' }], total: 1 });
    expect(store.items().length).toBe(1);
  });
  it('cancels stale filters and resets pagination', () => {
    TestBed.tick();
    const first = http.expectOne((r) => r.url === '/api/payments/me');
    store.filter('PAID', '');
    expect(first.cancelled).toBe(true);
    const filtered = http.expectOne((r) => r.params.get('status') === 'PAID');
    expect(filtered.request.params.get('offset')).toBe('0');
    filtered.flush({ items: [], total: 0 });
  });
  it('supports admin status and user filters', () => {
    store.configure(true);
    TestBed.tick();
    http.expectOne((r) => r.url === '/api/admin/payments').flush({ items: [], total: 0 });
    store.filter('CONFIRMED', 'user');
    const req = http.expectOne((r) => r.params.get('userId') === 'user');
    expect(req.request.url).toBe('/api/admin/payments');
    req.flush({ items: [], total: 0 });
  });
  it('clears private history and pending requests on logout', () => {
    TestBed.tick();
    http
      .expectOne((r) => r.url === '/api/payments/me')
      .flush({ items: [{ id: 'private' }], total: 1 });
    store.load();
    const req = http.expectOne((r) => r.url === '/api/payments/me');
    token.set(null);
    TestBed.tick();
    expect(req.cancelled).toBe(true);
    expect(store.items()).toEqual([]);
    expect(store.total()).toBe(0);
    expect(store.loading()).toBe(false);
  });
  it('exposes retry after a failed request', () => {
    TestBed.tick();
    http
      .expectOne((r) => r.url === '/api/payments/me')
      .flush({}, { status: 503, statusText: 'Unavailable' });
    expect(store.error()).toBeTruthy();
    store.load();
    http.expectOne((r) => r.url === '/api/payments/me').flush({ items: [], total: 0 });
    expect(store.error()).toBe('');
  });
});
