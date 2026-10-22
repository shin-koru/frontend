import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StorageService } from '../../../core/services/storage.service';
import { SessionService } from '../../../core/services/session.service';
import { ContentApi, toMovie } from '../service/content.api';
import { WatchlistStore } from './watchlist.store';

const id = '5bf81a5f-59ca-4ddb-8e0c-108b44e39a48';
const accountToken = (sub: string) => 'header.' + btoa(JSON.stringify({ sub })) + '.signature';
describe('Real-content watchlists', () => {
  let values: Map<string, string>;
  const token = signal<string | null>(null);
  const detail = vi.fn();
  beforeEach(() => {
    values = new Map();
    token.set(accountToken('account-a'));
    detail.mockReset();
    detail.mockReturnValue(
      of(
        toMovie({
          id,
          title: 'API title',
          type: 'MOVIE',
          status: 'PUBLISHED',
          createdAt: '',
          updatedAt: '',
        }),
      ),
    );
    TestBed.configureTestingModule({
      providers: [
        { provide: SessionService, useValue: { token } },
        { provide: ContentApi, useValue: { detail } },
        {
          provide: StorageService,
          useValue: {
            getItem: (key: string) => values.get(key) ?? null,
            setItem: (key: string, value: string) => values.set(key, value),
          },
        },
      ],
    });
  });
  it('persists real UUIDs and resolves the titles through the content API', () => {
    const store = TestBed.inject(WatchlistStore);
    TestBed.tick();
    store.toggle(id);
    TestBed.tick();
    expect(detail).toHaveBeenCalledWith(id);
    expect(store.movies()[0].title).toBe('API title');
    expect(JSON.parse(values.get('shin.watchlist.v2.account-a')!)).toEqual([id]);
    store.toggle(id);
    TestBed.tick();
    expect(store.movies()).toEqual([]);
  });
  it('keeps different accounts isolated and restores their own lists', () => {
    const store = TestBed.inject(WatchlistStore);
    TestBed.tick();
    store.toggle(id);
    TestBed.tick();
    token.set(accountToken('account-b'));
    TestBed.tick();
    expect(store.ids()).toEqual([]);
    token.set(accountToken('account-a'));
    TestBed.tick();
    expect(store.ids()).toEqual([id]);
    token.set(null);
    TestBed.tick();
    expect(store.movies()).toEqual([]);
  });
  it('recovers from corrupt saved data and rejects old sample slugs', () => {
    values.set('shin.watchlist.v2.account-a', '{broken');
    const store = TestBed.inject(WatchlistStore);
    TestBed.tick();
    expect(store.ids()).toEqual([]);
    store.toggle('dune-part-two');
    expect(store.ids()).toEqual([]);
  });
});
