import { HttpClient, HttpContext, HttpErrorResponse } from '@angular/common/http';
import { effect, inject, Injectable, signal } from '@angular/core';
import { SILENT_HTTP_ERROR } from '../../../core/interceptors/http-context';
import { Movie } from '../model/movie.model';

interface Playback {
  url: string;
  format: string;
  expiresAt: string;
}

@Injectable({ providedIn: 'root' })
export class PlaybackService {
  private readonly http = inject(HttpClient);
  readonly movie = signal<Movie | null>(null);
  readonly url = signal('');
  readonly format = signal('mp4');
  readonly loading = signal(false);
  readonly error = signal('');
  private readonly revision = signal(0);
  private expiresAt = 0;
  private renewAt = 0;
  private resumeAt = 0;
  private resumePlaying = false;
  constructor() {
    effect((onCleanup) => {
      const movie = this.movie();
      this.revision();
      this.error.set('');
      this.loading.set(!!movie);
      if (!movie) {
        this.url.set('');
        return;
      }
      const subscription = this.http
        .post<Playback>(
          `/api/content/${encodeURIComponent(movie.slug)}/playback`,
          {},
          {
            context: new HttpContext().set(SILENT_HTTP_ERROR, true),
          },
        )
        .subscribe({
          next: (result) => {
            this.loading.set(false);
            if (
              !['mp4', 'hls'].includes(result.format) ||
              !(Date.parse(result.expiresAt) > Date.now())
            ) {
              this.url.set('');
              this.error.set('This video is not ready for playback.');
              return;
            }
            this.expiresAt = Date.parse(result.expiresAt);
            this.format.set(result.format);
            this.renewAt = Date.now() + Math.max(1000, (this.expiresAt - Date.now()) * 0.8);
            this.url.set(result.url);
          },
          error: (error: HttpErrorResponse) => {
            this.loading.set(false);
            this.url.set('');
            this.error.set(
              error.status === 403
                ? 'An active subscription is required to watch this title.'
                : error.status === 401
                  ? 'Sign in again to watch this title.'
                  : error.status === 404 || error.status === 400
                    ? 'This title is not available to play.'
                    : 'Playback is temporarily unavailable. Please retry.',
            );
          },
        });
      onCleanup(() => subscription.unsubscribe());
    });
  }
  checkExpiry(video: HTMLVideoElement): void {
    if (this.loading() || this.error() || Date.now() < this.renewAt) return;
    this.resumeAt = video.currentTime;
    this.resumePlaying = !video.paused;
    this.loading.set(true);
    this.revision.update((value) => value + 1);
  }
  loaded(video: HTMLVideoElement): void {
    video.currentTime = this.resumeAt;
    if (this.resumePlaying)
      void video.play().catch(() => {
        /* Browser may require a play gesture. */
      });
  }
  failed(video: HTMLVideoElement): void {
    if (Date.now() >= this.renewAt && !this.loading()) this.checkExpiry(video);
    else if (!this.loading()) this.error.set('The video could not be played. Please retry.');
  }
  deliveryFailed(status: number, video: HTMLVideoElement): void {
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
  retry(): void {
    this.url.set('');
    this.revision.update((value) => value + 1);
  }
  open(movie: Movie): void {
    this.url.set('');
    this.resumeAt = 0;
    this.resumePlaying = false;
    this.movie.set(movie);
  }
  close(): void {
    this.movie.set(null);
    this.url.set('');
  }
}
