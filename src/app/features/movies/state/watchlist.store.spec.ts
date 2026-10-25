import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { SessionService } from '../../../core/services/session.service';
import { WatchlistStore } from './watchlist.store';
const id = '5bf81a5f-59ca-4ddb-8e0c-108b44e39a48';
const accountToken = (sub: string) => 'header.' + btoa(JSON.stringify({ sub })) + '.signature';
describe('Account-backed favorites', () => {
  let store: WatchlistStore;
  let http: HttpTestingController;
  const token = signal<string | null>(null);
  beforeEach(() => {
    token.set(accountToken('a'));
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SessionService, useValue: { token } },
      ],
    });
    store = TestBed.inject(WatchlistStore);
    http = TestBed.inject(HttpTestingController);
    TestBed.tick();
  });
  afterEach(() => http.verify());
  const page = (items: object[] = [], total = items.length) =>
    http
      .expectOne('/api/favorites?limit=12&offset=0')
      .flush({ items, meta: { totalItem: String(total) } });
  it('loads server favorites and uses idempotent mutations without local persistence', () => {
    page([{ id: 'favorite', contentId: id, title: 'A title', kind: 'content' }]);
    expect(store.has(id)).toBe(true);
    store.toggle(id);
    store.toggle(id);
    const remove = http.expectOne('/api/favorites/' + id);
    expect(remove.request.method).toBe('DELETE');
    expect(store.has(id)).toBe(true);
    remove.flush({ favorite: false });
    page();
    expect(store.has(id)).toBe(false);
    expect(store.items()).toEqual([]);
    store.toggle(id);
    const add = http.expectOne('/api/favorites/' + id);
    expect(add.request.method).toBe('PUT');
    expect(add.request.body).toEqual({});
    add.flush({ favorite: true });
    page([{ id: 'new', contentId: id, title: 'A title', kind: 'content' }]);
    expect(store.has(id)).toBe(true);
  });
  it('does not pretend failed mutations succeeded', () => {
    page([{ id: 'favorite', contentId: id, title: 'A title', kind: 'content' }]);
    store.toggle(id);
    http.expectOne('/api/favorites/' + id).flush({}, { status: 503, statusText: 'Unavailable' });
    expect(store.has(id)).toBe(true);
    expect(store.busy(id)).toBe(false);
    expect(store.notice()).toContain('couldn’t');
  });
  it('checks a title outside the loaded page before toggling', () => {
    page();
    store.ensure(id);
    http.expectOne('/api/favorites/' + id + '/status').flush({ favorite: true });
    store.toggle(id);
    http.expectOne('/api/favorites/' + id).flush({ favorite: false });
    page();
  });
  it('pages without N+1 detail calls and keeps account state isolated', () => {
    page([{ id: 'one', contentId: id, title: 'First', kind: 'content' }], 2);
    store.load();
    http
      .expectOne('/api/favorites?limit=12&offset=1')
      .flush({
        items: [{ id: 'two', contentId: 'other', title: 'Second', kind: 'content' }],
        meta: { totalItem: 2 },
      });
    expect(store.items()).toHaveLength(2);
    expect(store.hasMore()).toBe(false);
    token.set(accountToken('b'));
    TestBed.tick();
    expect(store.items()).toEqual([]);
    page();
    expect(store.has(id)).toBe(false);
    token.set(null);
    TestBed.tick();
    expect(store.items()).toEqual([]);
    expect(store.ids()).toEqual([]);
  });
  it('cancels stale reads and does not reset on same-account token refresh', () => {
    const pending = http.expectOne('/api/favorites?limit=12&offset=0');
    token.set(accountToken('b'));
    TestBed.tick();
    expect(pending.cancelled).toBe(true);
    page();
    token.set(accountToken('b') + 'new');
    TestBed.tick();
    http.expectNone('/api/favorites?limit=12&offset=0');
    store.toggle('sample-slug');
    expect(store.ids()).toEqual([]);
  });
});
