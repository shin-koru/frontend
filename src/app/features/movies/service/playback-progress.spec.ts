import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { SessionService } from '../../../core/services/session.service';
import { PlaybackService } from './playback.service';
describe('Playback progress and lifecycle', () => {
  let player: PlaybackService;
  let http: HttpTestingController;
  let now: number;
  const token = signal<string | null>('header.' + btoa(JSON.stringify({ sub: 'a' })) + '.sig');
  const video = (position = 20) =>
    ({
      currentTime: position,
      duration: 100,
      paused: false,
      play: vi.fn().mockResolvedValue(undefined),
    }) as unknown as HTMLVideoElement;
  const start = (kind: 'content' | 'episode' = 'content', resume = 0) => {
    player.open({ slug: 'title', title: 'Title' }, kind);
    http
      .expectOne(`/api/${kind}/title/playback`)
      .flush({
        sessionId: 's1',
        resumePositionSeconds: resume,
        url: 'media-1',
        format: 'mp4',
        expiresAt: new Date(now + 300000).toISOString(),
      });
  };
  beforeEach(() => {
    now = Date.now();
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    token.set('header.' + btoa(JSON.stringify({ sub: 'a' })) + '.sig');
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SessionService, useValue: { token } },
      ],
    });
    player = TestBed.inject(PlaybackService);
    http = TestBed.inject(HttpTestingController);
    TestBed.tick();
  });
  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });
  it('seeks to server resume, renews the same session and preserves local position', () => {
    start('episode', 37);
    const v = video(0);
    player.loaded(v);
    expect(v.currentTime).toBe(37);
    v.currentTime = 50;
    now += 250000;
    player.checkExpiry(v);
    player.checkExpiry(v);
    const request = http.expectOne('/api/episode/title/playback');
    expect(request.request.body).toEqual({ sessionId: 's1', deviceId: expect.any(String) });
    request.flush({
      sessionId: 's1',
      resumePositionSeconds: 20,
      url: 'media-2',
      format: 'hls',
      expiresAt: new Date(now + 300000).toISOString(),
    });
    v.currentTime = 0;
    player.loaded(v);
    expect(v.currentTime).toBe(50);
  });
  it('throttles heartbeats and coalesces in-flight updates with increasing sequences', () => {
    start();
    const v = video();
    player.timeUpdated(v);
    const first = http.expectOne('/api/playback-sessions/s1/progress');
    expect(first.request.body).toEqual({ sequence: 1, positionSeconds: 20, durationSeconds: 100 });
    v.currentTime = 25;
    player.timeUpdated(v);
    http.expectNone('/api/playback-sessions/s1/progress');
    v.currentTime = 30;
    player.paused(v);
    first.flush({ status: 'PLAYING' });
    const second = http.expectOne('/api/playback-sessions/s1/progress');
    expect(second.request.body.sequence).toBe(2);
    expect(second.request.body.positionSeconds).toBe(30);
    second.flush({ status: 'PLAYING' });
  });
  it('retries the identical sequence after a temporary failure', async () => {
    vi.useFakeTimers();
    start();
    player.timeUpdated(video());
    http
      .expectOne('/api/playback-sessions/s1/progress')
      .flush({}, { status: 503, statusText: 'Unavailable' });
    await vi.advanceTimersByTimeAsync(1000);
    const retry = http.expectOne('/api/playback-sessions/s1/progress');
    expect(retry.request.body.sequence).toBe(1);
    retry.flush({}, { status: 503, statusText: 'Unavailable' });
    expect(player.progressError()).toContain('couldn’t');
    player.retryProgress();
    const manual = http.expectOne('/api/playback-sessions/s1/progress');
    expect(manual.request.body.sequence).toBe(1);
    manual.flush({ status: 'PLAYING' });
    expect(player.progressError()).toBe('');
  });
  it('uses server completion, keeps renewal identity, and creates a fresh replay attempt', () => {
    start();
    player.ended(video(99));
    http.expectOne('/api/playback-sessions/s1/progress').flush({ status: 'COMPLETED' });
    expect(player.completed()).toBe(true);
    player.paused(video(100));
    http.expectNone('/api/playback-sessions/s1/progress');
    now += 250000;
    player.checkExpiry(video(99));
    const renewal = http.expectOne('/api/content/title/playback');
    expect(renewal.request.body).toEqual({ sessionId: 's1', deviceId: expect.any(String) });
    renewal.flush({
      sessionId: 's1',
      resumePositionSeconds: 99,
      url: 'media-2',
      format: 'mp4',
      expiresAt: new Date(now + 300000).toISOString(),
    });
    player.replay();
    const fresh = http.expectOne('/api/content/title/playback');
    expect(fresh.request.body).toEqual({ deviceId: expect.any(String) });
    fresh.flush({
      sessionId: 's2',
      resumePositionSeconds: 0,
      url: 'media-3',
      format: 'mp4',
      expiresAt: new Date(now + 300000).toISOString(),
    });
    expect(player.completed()).toBe(false);
  });
  it('flushes on close and rejects nonfinite reports', () => {
    start();
    const v = video();
    player.loaded(v);
    v.currentTime = 42;
    player.close();
    http.expectOne('/api/playback-sessions/s1/progress').flush({ status: 'PLAYING' });
    expect(player.movie()).toBeNull();
    start();
    const invalid = video(NaN);
    player.timeUpdated(invalid);
    http.expectNone('/api/playback-sessions/s1/progress');
  });
  it('stops reporting after an expired session and cancels state on account change', () => {
    start();
    player.timeUpdated(video());
    http
      .expectOne('/api/playback-sessions/s1/progress')
      .flush({}, { status: 400, statusText: 'Expired' });
    expect(player.canRetryProgress()).toBe(false);
    player.timeUpdated(video(30));
    http.expectNone('/api/playback-sessions/s1/progress');
    token.set(null);
    TestBed.tick();
    expect(player.movie()).toBeNull();
    expect(player.url()).toBe('');
  });
});
