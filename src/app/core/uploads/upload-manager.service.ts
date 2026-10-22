import {
  HttpClient,
  HttpContext,
  HttpErrorResponse,
  HttpEventType,
  HttpResponse,
} from '@angular/common/http';
import { effect, inject, Injectable, signal } from '@angular/core';
import { filter, firstValueFrom, fromEvent, map, Observable, Subject, takeUntil, tap } from 'rxjs';
import { SessionService } from '../services/session.service';
import { SILENT_HTTP_ERROR } from '../interceptors/http-context';
import { MultipartSession, UploadedFile, UploadPurpose, UploadRecord } from './upload.model';

const context = () => new HttpContext().set(SILENT_HTTP_ERROR, true);
const abortError = () => new DOMException('Upload stopped', 'AbortError');

export function tokenSubject(token: string | null): string | null {
  try {
    const subject: unknown = JSON.parse(
      atob((token ?? '').split('.')[1].replace(/-/g, '+').replace(/_/g, '/')),
    ).sub;
    return typeof subject === 'string' ? subject : null;
  } catch {
    return null;
  }
}

@Injectable({ providedIn: 'root' })
export class UploadManager {
  private readonly completedSubject = new Subject<UploadRecord>();
  readonly completed$ = this.completedSubject.asObservable();
  private readonly http = inject(HttpClient);
  private readonly session = inject(SessionService);
  private owner: string | null = null;
  private readonly controllers = new Map<string, AbortController>();
  private readonly files = new Map<string, File>();
  readonly records = signal<UploadRecord[]>([]);
  constructor() {
    effect(() => {
      const owner = tokenSubject(this.session.token());
      if (owner === this.owner) return;
      for (const controller of this.controllers.values()) controller.abort();
      this.controllers.clear();
      this.files.clear();
      this.owner = owner;
      let records: UploadRecord[] = [];
      try {
        const saved: unknown = JSON.parse(localStorage.getItem(this.storageKey()) ?? '[]');
        if (Array.isArray(saved))
          records = saved
            .filter(
              (r): r is UploadRecord =>
                r?.owner === owner &&
                typeof r.key === 'string' &&
                ['avatar', 'poster', 'video'].includes(r.purpose),
            )
            .map((r) => ({
              ...r,
              status: r.status === 'complete' || r.status === 'cancelled' ? r.status : 'paused',
              error: undefined,
            }));
      } catch {
        /* Storage is optional; uploads still work without persistence. */
      }
      this.records.set(records);
    });
  }
  record(key: string): UploadRecord | undefined {
    return this.records().find((r) => r.key === key);
  }
  busy(key: string): boolean {
    return ['hashing', 'uploading', 'verifying', 'saving', 'cancelling'].includes(
      this.record(key)?.status ?? '',
    );
  }
  hasFile(key: string): boolean {
    return this.files.has(key);
  }

  async select(
    key: string,
    purpose: UploadPurpose,
    file: File,
    contentId?: string,
    episodeId?: string,
  ): Promise<void> {
    if (this.busy(key)) return;
    const owner = tokenSubject(this.session.token());
    if (!owner) return;
    const old = this.record(key);
    if (old && old.status !== 'complete' && old.status !== 'cancelled') {
      if (old.contentId !== contentId || old.episodeId !== episodeId || old.purpose !== purpose)
        return;
      if (old.name !== file.name || old.size !== file.size || old.modified !== file.lastModified) {
        this.patch(key, {
          error:
            'Select the original file to resume, or cancel this upload before choosing another.',
        });
        return;
      }
    } else {
      const validImage = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type);
      const validVideo = ['video/mp4', 'video/webm', 'video/quicktime'].includes(file.type);
      const maximum =
        purpose === 'avatar'
          ? 5 * 1024 ** 2
          : purpose === 'poster'
            ? 20 * 1024 ** 2 - 4096
            : 100 * 1024 ** 3;
      if (!file.size || (purpose === 'video' ? !validVideo : !validImage) || file.size > maximum) {
        this.set({
          key,
          owner,
          purpose,
          contentId,
          episodeId,
          name: file.name,
          size: file.size,
          modified: file.lastModified,
          status: 'cancelled',
          progress: 0,
          error:
            purpose === 'video'
              ? 'Choose an MP4, WebM or MOV video up to 100 GiB.'
              : `Choose a JPG, PNG, GIF or WebP image up to ${purpose === 'avatar' ? '5' : '20'} MiB.`,
        });
        return;
      }
      this.set({
        key,
        owner,
        purpose,
        contentId,
        episodeId,
        name: file.name,
        size: file.size,
        modified: file.lastModified,
        status: 'ready',
        progress: 0,
      });
    }
    this.files.set(key, file);
    await this.run(key);
  }

  async resume(key: string): Promise<void> {
    if (
      !this.busy(key) &&
      (this.files.has(key) || this.record(key)?.result || this.record(key)?.sessionId)
    )
      await this.run(key);
  }
  pause(key: string): void {
    if (
      this.record(key)?.purpose !== 'video' ||
      !['hashing', 'uploading'].includes(this.record(key)?.status ?? '')
    )
      return;
    this.controllers.get(key)?.abort();
    this.patch(key, { status: 'paused', error: undefined });
  }
  async cancel(key: string): Promise<void> {
    const record = this.record(key);
    if (!record || ['saving', 'verifying', 'complete'].includes(record.status)) return;
    this.controllers.get(key)?.abort();
    const cancellation = new AbortController();
    this.controllers.set(key, cancellation);
    this.patch(key, { status: 'cancelling', error: undefined });
    try {
      if (record.sessionId)
        await this.request(
          this.http.delete(`/api/uploads/multipart/${record.sessionId}`, { context: context() }),
          cancellation.signal,
        );
      if (cancellation.signal.aborted || record.owner !== tokenSubject(this.session.token()))
        return;
      this.files.delete(key);
      this.patch(key, {
        status: 'cancelled',
        progress: 0,
        sessionId: undefined,
        result: undefined,
        checksum: undefined,
      });
    } catch {
      if (cancellation.signal.aborted) return;
      this.patch(key, {
        status: 'error',
        error: 'Cancellation could not be confirmed. Try cancelling again.',
      });
    } finally {
      if (this.controllers.get(key) === cancellation) this.controllers.delete(key);
    }
  }

  private async run(key: string): Promise<void> {
    const record = this.record(key);
    if (!record || record.owner !== tokenSubject(this.session.token())) return;
    const controller = new AbortController();
    this.controllers.set(key, controller);
    const signal = controller.signal;
    try {
      let result = record.result;
      const file = this.files.get(key);
      this.patch(key, { error: undefined });
      if (!result && record.purpose === 'video') {
        let session: MultipartSession | undefined;
        if (record.sessionId)
          session = await this.request(
            this.http.get<MultipartSession>(`/api/uploads/multipart/${record.sessionId}`, {
              context: context(),
            }),
            signal,
          );
        if (session?.status !== 'completed' && session?.status !== 'verifying') {
          if (!file) {
            this.patch(key, { status: 'paused', error: 'Select the original video to resume.' });
            return;
          }
          this.patch(key, { status: 'hashing', progress: 0 });
          const checksum = await this.hash(file, signal, (progress) =>
            this.patch(key, { progress: Math.round(progress * 100) }),
          );
          if (record.checksum && record.checksum !== checksum)
            throw new Error('This is not the original video. Select the original file.');
          this.patch(key, { checksum });
          if (!session) {
            session = await this.request(
              this.http.post<MultipartSession>(
                '/api/uploads/multipart',
                {
                  fileName: file.name,
                  size: file.size,
                  mimeType: file.type,
                  checksumSha256: checksum,
                  visibility: 'FILE_VISIBILITY_PUBLIC',
                },
                { context: context() },
              ),
              signal,
            );
            this.patch(key, { sessionId: session.sessionId });
          }
          if (session.status !== 'uploading')
            throw new Error(
              'This upload has expired or was cancelled. Cancel it here and start again.',
            );
          const done = new Set(session.parts.map((part) => part.partNumber));
          let uploaded = session.parts.reduce((sum, part) => sum + Number(part.size), 0);
          this.patch(key, {
            status: 'uploading',
            progress: Math.round((uploaded / file.size) * 100),
          });
          for (let part = 1; part <= session.partCount; part++) {
            if (done.has(part)) continue;
            const chunk = file.slice(
              (part - 1) * Number(session.partSize),
              Math.min(part * Number(session.partSize), file.size),
            );
            const signed = await this.request(
              this.http.post<{ url: string }>(
                `/api/uploads/multipart/${session.sessionId}/parts/${part}`,
                {},
                { context: context() },
              ),
              signal,
            );
            await this.put(signed.url, chunk, signal, (loaded) =>
              this.patch(key, {
                progress: Math.min(100, Math.round(((uploaded + loaded) / file.size) * 100)),
              }),
            );
            uploaded += chunk.size;
            this.patch(key, { progress: Math.round((uploaded / file.size) * 100) });
          }
        }
        if (!session) throw new Error('Upload session unavailable.');
        this.patch(key, { status: 'verifying', progress: 100 });
        result = await this.request(
          this.http.post<UploadedFile>(
            `/api/uploads/multipart/${session.sessionId}/complete`,
            {},
            { context: context() },
          ),
          signal,
        );
      } else if (!result) {
        if (!file) {
          this.patch(key, { status: 'paused', error: 'Select the image again to retry.' });
          return;
        }
        this.patch(key, { status: 'uploading', progress: 0 });
        const form = new FormData();
        form.set('file', file);
        form.set(
          'visibility',
          record.purpose === 'avatar' ? 'FILE_VISIBILITY_PRIVATE' : 'FILE_VISIBILITY_PUBLIC',
        );
        result = await this.smallImage(form, signal, (progress) => this.patch(key, { progress }));
      }
      if (signal.aborted) return;
      this.patch(key, { result, status: 'saving', progress: 100 });
      if (record.purpose === 'avatar')
        await this.request(
          this.http.patch(
            '/api/profile/@me/avatar',
            { avatarKey: result.objectKey },
            { context: context() },
          ),
          signal,
        );
      else
        await this.request(
          this.http.patch(
            record.episodeId
              ? `/api/episode/${record.episodeId}/media`
              : `/api/content/${record.contentId}/media`,
            {
              [record.episodeId
                ? 'videoKey'
                : record.purpose === 'video'
                  ? 'videoObjectKey'
                  : 'posterObjectKey']: result.objectKey,
            },
            { context: context() },
          ),
          signal,
        );
      this.files.delete(key);
      this.patch(key, { status: 'complete' });
      const finished = this.record(key);
      if (finished?.owner === tokenSubject(this.session.token()))
        this.completedSubject.next(finished);
    } catch (error) {
      if (!signal.aborted)
        this.patch(key, {
          status: 'error',
          error:
            error instanceof HttpErrorResponse
              ? error.status === 409
                ? 'Upload is busy verifying. Wait a moment, then resume.'
                : (error.error?.message ?? 'Connection interrupted. Resume to retry.')
              : error instanceof Error
                ? error.message
                : 'Upload interrupted. Please retry.',
        });
    } finally {
      if (this.controllers.get(key) === controller) this.controllers.delete(key);
    }
  }

  private hash(
    file: File,
    signal: AbortSignal,
    progress: (value: number) => void,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const worker = new Worker(new URL('./hash.worker', import.meta.url), { type: 'module' });
      const finish = () => {
        worker.terminate();
        signal.removeEventListener('abort', abort);
      };
      const abort = () => {
        finish();
        reject(abortError());
      };
      signal.addEventListener('abort', abort, { once: true });
      worker.onmessage = ({
        data,
      }: MessageEvent<{ progress?: number; checksum?: string; error?: string }>) => {
        if (data.progress !== undefined) progress(data.progress);
        if (data.checksum) {
          finish();
          resolve(data.checksum);
        }
        if (data.error) {
          finish();
          reject(new Error(data.error));
        }
      };
      worker.onerror = () => {
        finish();
        reject(new Error('Could not calculate the video checksum.'));
      };
      if (signal.aborted) abort();
      else worker.postMessage(file);
    });
  }
  private put(
    url: string,
    chunk: Blob,
    signal: AbortSignal,
    progress: (loaded: number) => void,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', url);
      xhr.withCredentials = false;
      const abort = () => xhr.abort();
      const finish = () => signal.removeEventListener('abort', abort);
      xhr.upload.onprogress = (event) => progress(event.loaded);
      xhr.onload = () => {
        finish();
        xhr.status >= 200 && xhr.status < 300
          ? resolve()
          : reject(new Error('Video transfer failed. Resume to request a fresh upload link.'));
      };
      xhr.onerror = () => {
        finish();
        reject(new Error('Connection interrupted. Resume when you are online.'));
      };
      xhr.onabort = () => {
        finish();
        reject(abortError());
      };
      signal.addEventListener('abort', abort, { once: true });
      if (signal.aborted) {
        finish();
        reject(abortError());
      } else xhr.send(chunk);
    });
  }
  private smallImage(
    form: FormData,
    signal: AbortSignal,
    progress: (percent: number) => void,
  ): Promise<UploadedFile> {
    return this.request(
      this.http
        .post<UploadedFile>('/api/uploads/files', form, {
          observe: 'events',
          reportProgress: true,
          context: context(),
        })
        .pipe(
          tap((event) => {
            if (event.type === HttpEventType.UploadProgress && event.total)
              progress(Math.round((event.loaded / event.total) * 100));
          }),
          filter(
            (event): event is HttpResponse<UploadedFile> => event.type === HttpEventType.Response,
          ),
          map((event) => {
            if (!event.body) throw new Error('Upload response was empty.');
            return event.body;
          }),
        ),
      signal,
    );
  }
  private request<T>(source: Observable<T>, signal: AbortSignal): Promise<T> {
    if (signal.aborted) return Promise.reject(abortError());
    return firstValueFrom(source.pipe(takeUntil(fromEvent(signal, 'abort'))));
  }
  private storageKey(): string {
    return `shin.uploads.v1.${this.owner ?? 'anonymous'}`;
  }
  private set(record: UploadRecord): void {
    this.records.update((records) => [...records.filter((r) => r.key !== record.key), record]);
    this.persist();
  }
  private patch(key: string, patch: Partial<UploadRecord>): void {
    if (this.record(key)?.owner !== tokenSubject(this.session.token())) return;
    this.records.update((records) => records.map((r) => (r.key === key ? { ...r, ...patch } : r)));
    this.persist();
  }
  private persist(): void {
    try {
      if (this.owner) localStorage.setItem(this.storageKey(), JSON.stringify(this.records()));
    } catch {
      /* Private browsing or full storage should not interrupt transfers. */
    }
  }
}
