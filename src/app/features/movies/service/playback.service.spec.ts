import { signal } from '@angular/core';
import { SessionService } from '../../../core/services/session.service';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Movie } from '../model/movie.model';
import { PlaybackService } from './playback.service';

describe('Playback authorization client', () => {
  let service: PlaybackService;
  let http: HttpTestingController;
  const movie: Movie = {
    slug: 'movie-id',
    title: 'Movie',
    year: 2026,
    genre: 'Movie',
    color: '',
    duration: '',
    classification: '',
    description: '',
    type: 'movie',
  };
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SessionService, useValue: { token: signal(null) } },
      ],
    });
    service = TestBed.inject(PlaybackService);
    http = TestBed.inject(HttpTestingController);
    TestBed.tick();
  });
  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
  });
  it('uses content ID without requiring a storage key', () => {
    service.open(movie);
    TestBed.tick();
    const request = http.expectOne('/api/content/movie-id/playback');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({});
    request.flush({
      sessionId: 'session-1',
      resumePositionSeconds: 0,
      url: 'https://media.example/signed',
      format: 'mp4',
      expiresAt: new Date(Date.now() + 300000).toISOString(),
    });
    expect(service.url()).toBe('https://media.example/signed');
  });
  it('shows entitlement failures and allows explicit retry', () => {
    service.open(movie);
    TestBed.tick();
    http
      .expectOne('/api/content/movie-id/playback')
      .flush(
        { sessionId: 'session-1', resumePositionSeconds: 0 },
        { status: 403, statusText: 'Forbidden' },
      );
    expect(service.error()).toContain('active subscription');
    expect(service.url()).toBe('');
    service.retry();
    TestBed.tick();
    http
      .expectOne('/api/content/movie-id/playback')
      .flush({
        sessionId: 'session-1',
        resumePositionSeconds: 0,
        url: 'signed',
        format: 'mp4',
        expiresAt: new Date(Date.now() + 300000).toISOString(),
      });
    expect(service.error()).toBe('');
  });
  it('renews once, preserving seek position and paused state', () => {
    let now = Date.now();
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    service.open(movie);
    TestBed.tick();
    http
      .expectOne('/api/content/movie-id/playback')
      .flush({
        sessionId: 'session-1',
        resumePositionSeconds: 0,
        url: 'first',
        format: 'mp4',
        expiresAt: new Date(now + 300000).toISOString(),
      });
    now += 250000;
    const video = { currentTime: 123, paused: true } as HTMLVideoElement;
    service.checkExpiry(video);
    service.checkExpiry(video);
    TestBed.tick();
    http
      .expectOne('/api/content/movie-id/playback')
      .flush({
        sessionId: 'session-1',
        resumePositionSeconds: 0,
        url: 'second',
        format: 'mp4',
        expiresAt: new Date(now + 300000).toISOString(),
      });
    video.currentTime = 0;
    service.loaded(video);
    expect(video.currentTime).toBe(123);
    expect(service.url()).toBe('second');
  });
  it('cancels stale requests when closed', () => {
    service.open(movie);
    TestBed.tick();
    const request = http.expectOne('/api/content/movie-id/playback');
    service.close();
    TestBed.tick();
    expect(request.cancelled).toBe(true);
    expect(service.url()).toBe('');
  });
  it('accepts HLS and stops delivery when a subscription is revoked', () => {
    service.open(movie);
    TestBed.tick();
    http
      .expectOne('/api/content/movie-id/playback')
      .flush({
        sessionId: 'session-1',
        resumePositionSeconds: 0,
        url: 'https://media.example/hls/grant/master.m3u8',
        format: 'hls',
        expiresAt: new Date(Date.now() + 300000).toISOString(),
      });
    expect(service.format()).toBe('hls');
    service.deliveryFailed(403, { currentTime: 12, paused: false } as HTMLVideoElement);
    expect(service.url()).toBe('');
    expect(service.error()).toContain('subscription');
    http.expectNone('/api/content/movie-id/playback');
  });
  it('reauthorizes an expired HLS grant once and preserves position', () => {
    let now = Date.now();
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    service.open(movie);
    TestBed.tick();
    http
      .expectOne('/api/content/movie-id/playback')
      .flush({
        sessionId: 'session-1',
        resumePositionSeconds: 0,
        url: 'first',
        format: 'hls',
        expiresAt: new Date(now + 10000).toISOString(),
      });
    now += 11000;
    const video = { currentTime: 42, paused: true } as HTMLVideoElement;
    service.deliveryFailed(401, video);
    service.deliveryFailed(401, video);
    TestBed.tick();
    http
      .expectOne('/api/content/movie-id/playback')
      .flush({
        sessionId: 'session-1',
        resumePositionSeconds: 0,
        url: 'second',
        format: 'hls',
        expiresAt: new Date(now + 10000).toISOString(),
      });
    video.currentTime = 0;
    service.loaded(video);
    expect(video.currentTime).toBe(42);
  });
});
