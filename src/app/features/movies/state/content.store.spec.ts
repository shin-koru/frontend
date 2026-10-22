import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SessionService } from '../../../core/services/session.service';
import { ContentStore } from './content.store';

describe('Live catalog pagination', () => {
  const token = signal<string | null>('session');
  let store: ContentStore;
  let requests: HttpTestingController;
  const published = {
    id: '5bf81a5f-59ca-4ddb-8e0c-108b44e39a48',
    title: 'Published',
    type: 'MOVIE',
    status: 'PUBLISHED',
  };
  beforeEach(() => {
    token.set('session');
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SessionService, useValue: { token } },
      ],
    });
    store = TestBed.inject(ContentStore);
    requests = TestBed.inject(HttpTestingController);
    TestBed.tick();
  });
  afterEach(() => requests.verify());
  it('cancels an old search, resets pagination and retains filters for subsequent pages', () => {
    store.search({ query: 'old' });
    const old = requests.expectOne('/api/search?q=old&limit=12&offset=0');
    store.search({ query: 'new', type: 'MOVIE', year: 2020, sort: 'title' });
    expect(old.cancelled).toBe(true);
    requests
      .expectOne('/api/search?year=2020&sort=title&q=new&type=MOVIE&limit=12&offset=0')
      .flush({ items: [published], meta: { totalItem: 2 } });
    expect(store.total()).toBe(2);
    store.loadMore();
    requests
      .expectOne('/api/search?year=2020&sort=title&q=new&type=MOVIE&limit=12&offset=1')
      .flush({ items: [{ ...published, id: 'second' }], meta: { totalItem: 2 } });
    expect(store.movies()).toHaveLength(2);
    expect(store.hasMore()).toBe(false);
  });
  it('advances by raw server records while only displaying published titles', () => {
    store.load();
    store.load();
    requests.expectOne('/api/content/limit/12/offset/0').flush({
      items: [published, { ...published, id: 'draft', status: 'DRAFT' }],
      meta: { totalItem: { low: 3, high: 0 } },
    });
    expect(store.movies().map((item) => item.title)).toEqual(['Published']);
    expect(store.offset()).toBe(2);
    expect(store.hasMore()).toBe(true);
    store.loadMore();
    requests.expectOne('/api/content/limit/12/offset/2').flush({
      items: [{ ...published, id: 'archived', status: 'ARCHIVED' }],
      meta: { totalItem: { low: 3, high: 0 } },
    });
    expect(store.offset()).toBe(3);
    expect(store.hasMore()).toBe(false);
    expect(store.movies()).toHaveLength(1);
  });
  it('does not restore private catalog data from an in-flight request after logout', () => {
    store.load();
    const request = requests.expectOne('/api/content/limit/12/offset/0');
    token.set(null);
    TestBed.tick();
    request.flush({ items: [published], meta: { totalItem: 1 } });
    expect(store.movies()).toEqual([]);
    expect(store.loaded()).toBe(false);
  });
});
