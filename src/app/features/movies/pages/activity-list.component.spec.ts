import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { SessionService } from '../../../core/services/session.service';
import { PlaybackService } from '../service/playback.service';
import { ActivityListComponent } from './activity-list.component';
import { WatchlistStore } from '../state/watchlist.store';
describe('Activity lists', () => {
  let http: HttpTestingController;
  const token = signal<string | null>('a');
  const forget = vi.fn();
  beforeEach(() => {
    token.set('a');
    forget.mockReset();
    TestBed.configureTestingModule({
      imports: [ActivityListComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: SessionService, useValue: { token } },
        { provide: PlaybackService, useValue: { forget, openActivity: vi.fn() } },
        { provide: WatchlistStore, useValue: { loading: signal(false), error: signal(false) } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it('loads paginated attempts and clears history only on explicit confirmation action', () => {
    const fixture = TestBed.createComponent(ActivityListComponent);
    fixture.componentRef.setInput('mode', 'history');
    fixture.detectChanges();
    http
      .expectOne('/api/watch-history?limit=12&offset=0')
      .flush({
        items: [
          { id: 's1', contentId: 'movie', kind: 'content', title: 'Title', status: 'AUTHORIZED' },
        ],
        meta: { totalItem: '2' },
      });
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Opened · no progress reported',
    );
    fixture.componentInstance.load();
    http
      .expectOne('/api/watch-history?limit=12&offset=1')
      .flush({
        items: [
          { id: 's2', contentId: 'movie', kind: 'content', title: 'Title', status: 'PLAYING' },
        ],
        meta: { totalItem: 2 },
      });
    expect(fixture.componentInstance.items()).toHaveLength(2);
    fixture.componentInstance.confirming.set(true);
    http.expectNone((r) => r.method === 'DELETE');
    fixture.componentInstance.clear();
    expect(forget).toHaveBeenCalledWith();
    http.expectOne((r) => r.url === '/api/watch-history' && r.method === 'DELETE').flush({});
    TestBed.tick();
    http
      .expectOne('/api/watch-history?limit=12&offset=0')
      .flush({ items: [], meta: { totalItem: 0 } });
    expect(fixture.componentInstance.items()).toEqual([]);
  });
  it('deletes the precise episode progress and fences active playback', () => {
    const fixture = TestBed.createComponent(ActivityListComponent);
    fixture.detectChanges();
    const item = {
      id: 'p1',
      contentId: 'episode',
      kind: 'episode' as const,
      title: 'Episode',
      positionSeconds: 10,
    };
    http
      .expectOne('/api/watch-history/continue-watching?limit=12&offset=0')
      .flush({ items: [item], meta: { totalItem: 1 } });
    fixture.componentInstance.remove(item);
    expect(forget).toHaveBeenCalledWith('episode', 'episode');
    http.expectOne('/api/watch-history/progress/episode?kind=episode').flush({});
    TestBed.tick();
    http
      .expectOne('/api/watch-history/continue-watching?limit=12&offset=0')
      .flush({ items: [], meta: { totalItem: 0 } });
  });
  it('clears stale state and cancels pending reads on logout', () => {
    const fixture = TestBed.createComponent(ActivityListComponent);
    fixture.detectChanges();
    const pending = http.expectOne('/api/watch-history/continue-watching?limit=12&offset=0');
    token.set(null);
    TestBed.tick();
    expect(pending.cancelled).toBe(true);
    expect(fixture.componentInstance.items()).toEqual([]);
  });
});
