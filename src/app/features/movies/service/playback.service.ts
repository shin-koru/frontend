import { HttpClient, HttpContext, HttpErrorResponse } from '@angular/common/http';
import { DestroyRef, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { Subscription, retry, timer, throwError } from 'rxjs';
import { SILENT_HTTP_ERROR } from '../../../core/interceptors/http-context';
import { DeviceService } from '../../../core/services/device.service';
import { SessionService } from '../../../core/services/session.service';
import { Movie } from '../model/movie.model';
import {
  ActivityApi,
  ActivityItem,
  PlayableKind,
  ProgressReport,
  sessionAccount,
} from './activity.api';
interface Playback {
  url: string;
  format: string;
  expiresAt: string;
  sessionId: string;
  resumePositionSeconds: number;
}
interface Attempt {
  id: string;
  sequence: number;
  completed: boolean;
  lastPosition: number;
  lastSentAt: number;
  pending?: ProgressReport;
  queued?: { positionSeconds: number; durationSeconds?: number };
  request?: Subscription;
  blocked: boolean;
}
@Injectable({ providedIn: 'root' })
export class PlaybackService {
  private readonly http = inject(HttpClient);
  private readonly activity = inject(ActivityApi);
  private readonly session = inject(SessionService);
  private readonly device = inject(DeviceService);
  readonly movie = signal<Pick<Movie, 'slug' | 'title'> | null>(null);
  readonly url = signal('');
  readonly format = signal('mp4');
  readonly loading = signal(false);
  readonly error = signal('');
  readonly progressError = signal('');
  readonly completed = signal(false);
  private writes = new Subscription();
  private kind: PlayableKind = 'content';
  private attempt?: Attempt;
  private authorization?: Subscription;
  private generation = 0;
  private owner = '';
  private renewAt = 0;
  private resumeAt = 0;
  private resumePlaying = false;
  private video?: HTMLVideoElement;
  private endedPlayback = false;
  constructor() {
    effect(() => {
      const owner = sessionAccount(this.session.token());
      untracked(() => {
        if (owner !== this.owner) {
          const previous = this.owner;
          this.owner = owner;
          if (previous) this.forget();
        }
      });
    });
    inject(DestroyRef).onDestroy(() => {
      this.authorization?.unsubscribe();
      this.writes.unsubscribe();
    });
  }
  open(movie: Pick<Movie, 'slug' | 'title'>, kind: PlayableKind = 'content'): void {
    this.close();
    this.movie.set(movie);
    this.kind = kind;
    this.resumeAt = 0;
    this.resumePlaying = false;
    this.completed.set(false);
    this.endedPlayback = false;
    this.progressError.set('');
    this.authorize(false);
  }
  openActivity(item: ActivityItem) {
    this.open(
      {
        slug: item.contentId,
        title: item.parentTitle ? `${item.parentTitle} — ${item.title}` : item.title,
      },
      item.kind,
    );
  }
  private authorize(renew: boolean) {
    const movie = this.movie();
    if (!movie) return;
    this.authorization?.unsubscribe();
    const generation = ++this.generation;
    this.loading.set(true);
    this.error.set('');
    this.authorization = this.http
      .post<Playback>(
        `/api/${this.kind === 'episode' ? 'episode' : 'content'}/${encodeURIComponent(movie.slug)}/playback`,
        renew && this.attempt
          ? { sessionId: this.attempt.id, deviceId: this.device.id() }
          : { deviceId: this.device.id() },
        { context: new HttpContext().set(SILENT_HTTP_ERROR, true) },
      )
      .subscribe({
        next: (result) => {
          if (generation !== this.generation) return;
          this.loading.set(false);
          if (
            !['mp4', 'hls'].includes(result.format) ||
            !(Date.parse(result.expiresAt) > Date.now()) ||
            !result.sessionId
          ) {
            this.url.set('');
            this.error.set('This video is not ready for playback.');
            return;
          }
          if (!renew) {
            this.completed.set(false);
            this.resumeAt = Math.max(0, result.resumePositionSeconds || 0);
            this.attempt = {
              id: result.sessionId,
              sequence: 0,
              completed: false,
              lastPosition: -1,
              lastSentAt: 0,
              blocked: false,
            };
          }
          this.format.set(result.format);
          this.renewAt =
            Date.now() + Math.max(1000, (Date.parse(result.expiresAt) - Date.now()) * 0.8);
          this.url.set(result.url);
          this.activity.changed();
        },
        error: (error: HttpErrorResponse) => {
          if (generation !== this.generation) return;
          this.loading.set(false);
          this.url.set('');
          if (renew && (error.status === 400 || error.status === 404)) {
            this.attempt?.request?.unsubscribe();
            this.attempt = undefined;
          }
          this.error.set(
            error.status === 429
              ? typeof error.error?.message === 'string'
                ? error.error.message
                : 'Too many devices are streaming on this account. Stop playback on another device and retry.'
              : error.status === 403
              ? 'An active subscription is required to watch this title.'
              : error.status === 401
                ? 'Sign in again to watch this title.'
                : error.status === 404
                  ? 'This title is not available to play.'
                  : error.status === 400
                    ? 'This playback session has ended. Retry to start a new session.'
                    : 'Playback is temporarily unavailable. Please retry.',
          );
        },
      });
  }
  loaded(video: HTMLVideoElement) {
    this.video = video;
    video.currentTime = Number.isFinite(video.duration)
      ? Math.min(this.resumeAt, video.duration)
      : this.resumeAt;
    if (this.resumePlaying) void video.play().catch(() => {});
  }
  timeUpdated(video: HTMLVideoElement) {
    this.video = video;
    this.report(video, false);
    this.checkExpiry(video);
  }
  paused(video: HTMLVideoElement) {
    if (!this.loading()) this.report(video, true);
  }
  ended(video: HTMLVideoElement) {
    this.endedPlayback = true;
    this.report(video, true);
  }
  played(video: HTMLVideoElement) {
    this.video = video;
    if (
      this.attempt?.completed &&
      (this.endedPlayback || video.currentTime < this.attempt.lastPosition)
    ) {
      const movie = this.movie();
      if (movie) {
        const kind = this.kind;
        this.open(movie, kind);
        this.resumePlaying = true;
      }
      return;
    }
    this.checkExpiry(video);
  }
  report(video: HTMLVideoElement, force: boolean) {
    const attempt = this.attempt;
    if (
      !attempt ||
      attempt.completed ||
      attempt.blocked ||
      !this.url() ||
      (!force && this.loading()) ||
      !Number.isFinite(video.currentTime) ||
      video.currentTime < 0
    )
      return;
    if (!force && (video.paused || Date.now() - attempt.lastSentAt < 15000)) return;
    if (video.currentTime === attempt.lastPosition && !attempt.pending) return;
    const value = {
      positionSeconds: video.currentTime,
      ...(Number.isFinite(video.duration) && video.duration > 0
        ? { durationSeconds: video.duration }
        : {}),
    };
    if (attempt.pending) {
      attempt.queued = value;
      return;
    }
    attempt.pending = { ...value, sequence: ++attempt.sequence };
    this.send(attempt);
  }
  private send(attempt: Attempt) {
    if (!attempt.pending || (attempt.request && !attempt.request.closed)) return;
    const payload = attempt.pending;
    attempt.lastSentAt = Date.now();
    attempt.request = this.activity
      .report(attempt.id, payload)
      .pipe(
        retry({
          count: 1,
          delay: (e: HttpErrorResponse) =>
            e.status === 0 || e.status >= 500 ? timer(1000) : throwError(() => e),
        }),
      )
      .subscribe({
        next: (item) => {
          attempt.pending = undefined;
          attempt.lastPosition = payload.positionSeconds;
          attempt.completed = item.status === 'COMPLETED';
          attempt.request = undefined;
          if (this.attempt === attempt) {
            this.progressError.set('');
            this.completed.set(attempt.completed);
            if (attempt.completed) this.activity.changed();
          }
          if (this.attempt !== attempt) this.activity.changed();
          const queued = attempt.queued;
          attempt.queued = undefined;
          if (queued && !attempt.completed && queued.positionSeconds !== attempt.lastPosition) {
            attempt.pending = { ...queued, sequence: ++attempt.sequence };
            this.send(attempt);
          }
        },
        error: (e: HttpErrorResponse) => {
          attempt.request = undefined;
          attempt.blocked = [400, 401, 403, 404].includes(e.status);
          if (this.attempt === attempt)
            this.progressError.set(
              attempt.blocked
                ? 'Progress can no longer be saved for this session. Reopen the title to continue saving.'
                : 'Your progress couldn’t be saved. Retry when your connection is back.',
            );
        },
      });
    this.writes.add(attempt.request);
  }
  retryProgress() {
    if (this.attempt && !this.attempt.blocked) this.send(this.attempt);
  }
  canRetryProgress() {
    return !!this.attempt?.pending && !this.attempt.blocked;
  }
  checkExpiry(video: HTMLVideoElement) {
    if (this.loading() || this.error() || Date.now() < this.renewAt) return;
    this.resumeAt = video.currentTime;
    this.resumePlaying = !video.paused;
    this.authorize(true);
  }
  failed(video: HTMLVideoElement) {
    if (Date.now() >= this.renewAt && !this.loading()) this.checkExpiry(video);
    else if (!this.loading()) this.error.set('The video could not be played. Please retry.');
  }
  deliveryFailed(status: number, video: HTMLVideoElement) {
    if (status === 401 && Date.now() >= this.renewAt) {
      this.checkExpiry(video);
      return;
    }
    this.resumeAt = video.currentTime;
    this.resumePlaying = !video.paused;
    this.url.set('');
    this.error.set(
      status === 403
        ? 'An active subscription with access to this quality is required.'
        : status === 404
          ? 'This title is not available to play.'
          : status === 415
            ? 'This browser does not support HLS playback.'
            : 'The video could not be played. Please retry.',
    );
  }
  retry() {
    this.url.set('');
    this.authorize(!!this.attempt && !this.attempt.blocked);
  }
  replay() {
    const movie = this.movie();
    if (movie) this.open(movie, this.kind);
  }
  close() {
    if (this.video) this.report(this.video, true);
    this.detach(false);
  }
  forget(id?: string, kind?: PlayableKind) {
    if (id && (this.movie()?.slug !== id || this.kind !== kind)) return;
    this.detach(true);
  }
  private detach(cancel: boolean) {
    this.generation++;
    this.authorization?.unsubscribe();
    if (cancel) {
      this.writes.unsubscribe();
      this.writes = new Subscription();
    }
    this.attempt = undefined;
    this.video = undefined;
    this.movie.set(null);
    this.url.set('');
    this.loading.set(false);
    this.error.set('');
    this.progressError.set('');
    this.activity.changed();
  }
}
