import { provideHttpClient, HttpEventType } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SessionService } from '../services/session.service';
import { UploadManager, tokenSubject } from './upload-manager.service';

describe('UploadManager', () => {
  const token = signal<string | null>(null);
  let manager: UploadManager;
  let http: HttpTestingController;
  const image = () =>
    new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], 'avatar.png', {
      type: 'image/png',
      lastModified: 123,
    });
  const result = {
    objectKey: 'user-1/file.png',
    bucket: 'private',
    fileName: 'avatar.png',
    mimeType: 'image/png',
    size: 8,
  };
  const settle = async () => {
    await Promise.resolve();
    await Promise.resolve();
  };
  beforeEach(() => {
    const items = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => items.get(key) ?? null,
      setItem: (key: string, value: string) => items.set(key, value),
      removeItem: (key: string) => items.delete(key),
      clear: () => items.clear(),
    });
    localStorage.clear();
    token.set('header.' + btoa(JSON.stringify({ sub: 'user-1' })) + '.signature');
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SessionService, useValue: { token } },
      ],
    });
    manager = TestBed.inject(UploadManager);
    http = TestBed.inject(HttpTestingController);
    TestBed.tick();
  });
  afterEach(() => {
    http?.verify();
    vi.unstubAllGlobals();
  });
  it('validates images before sending requests', async () => {
    await manager.select(
      'avatar',
      'avatar',
      new File(['bad'], 'bad.svg', { type: 'image/svg+xml' }),
    );
    expect(manager.record('avatar')?.status).toBe('cancelled');
    http.expectNone('/api/uploads/files');
  });
  it('reports progress and saves the private object to the profile', async () => {
    const pending = manager.select('avatar', 'avatar', image());
    const upload = http.expectOne('/api/uploads/files');
    expect((upload.request.body as FormData).get('visibility')).toBe('FILE_VISIBILITY_PRIVATE');
    upload.event({ type: HttpEventType.UploadProgress, loaded: 4, total: 8 });
    expect(manager.record('avatar')?.progress).toBe(50);
    upload.flush(result);
    await settle();
    const save = http.expectOne('/api/profile/@me/avatar');
    expect(save.request.body).toEqual({ avatarKey: result.objectKey });
    save.flush({});
    await pending;
    expect(manager.record('avatar')?.status).toBe('complete');
  });
  it('retries saving a completed upload without sending the image again', async () => {
    const pending = manager.select('avatar', 'avatar', image());
    http.expectOne('/api/uploads/files').flush(result);
    await settle();
    http.expectOne('/api/profile/@me/avatar').flush({}, { status: 503, statusText: 'Unavailable' });
    await pending;
    expect(manager.record('avatar')?.result?.objectKey).toBe(result.objectKey);
    const retry = manager.resume('avatar');
    await settle();
    http.expectNone('/api/uploads/files');
    http.expectOne('/api/profile/@me/avatar').flush({});
    await retry;
    expect(manager.record('avatar')?.status).toBe('complete');
  });
  it('cancels a transfer and avoids saving it', async () => {
    const pending = manager.select('avatar', 'avatar', image());
    const upload = http.expectOne('/api/uploads/files');
    await manager.cancel('avatar');
    await pending;
    expect(upload.cancelled).toBe(true);
    expect(manager.record('avatar')?.status).toBe('cancelled');
    http.expectNone('/api/profile/@me/avatar');
  });
  it('stops transfers and clears visible state when signing out', async () => {
    const pending = manager.select('avatar', 'avatar', image());
    const upload = http.expectOne('/api/uploads/files');
    token.set(null);
    TestBed.tick();
    await pending;
    expect(upload.cancelled).toBe(true);
    expect(manager.records()).toEqual([]);
  });
  it('never derives ownership from malformed tokens', () => {
    expect(tokenSubject('bad')).toBeNull();
  });
  it('does not revive cancelled uploads when restoring an account', async () => {
    const originalToken = token();
    const pending = manager.select('avatar', 'avatar', image());
    http.expectOne('/api/uploads/files');
    await manager.cancel('avatar');
    await pending;
    token.set(null);
    TestBed.tick();
    token.set(originalToken);
    TestBed.tick();
    expect(manager.record('avatar')?.status).toBe('cancelled');
  });
  it('also cancels cancellation requests when the account changes', async () => {
    manager.records.set([
      {
        key: 'movie',
        owner: 'user-1',
        purpose: 'video',
        name: 'movie.mp4',
        size: 32,
        modified: 123,
        status: 'paused',
        progress: 50,
        sessionId: 'session-1',
      },
    ]);
    const pending = manager.cancel('movie');
    const cancellation = http.expectOne('/api/uploads/multipart/session-1');
    token.set(null);
    TestBed.tick();
    await pending;
    expect(cancellation.cancelled).toBe(true);
    expect(manager.records()).toEqual([]);
  });
  it('saves an already uploaded episode video to its episode endpoint', async () => {
    manager.records.set([
      {
        key: 'episode-video',
        owner: 'user-1',
        purpose: 'video',
        episodeId: 'episode-1',
        name: 'episode.mp4',
        size: 32,
        modified: 123,
        status: 'error',
        progress: 100,
        result: { ...result, objectKey: 'episode-video', mimeType: 'video/mp4' },
      },
    ]);
    const pending = manager.resume('episode-video');
    await settle();
    const save = http.expectOne('/api/episode/episode-1/media');
    expect(save.request.body).toEqual({ videoKey: 'episode-video' });
    http.expectNone('/api/content/undefined/media');
    save.flush({});
    await pending;
    expect(manager.record('episode-video')?.status).toBe('complete');
  });
});
