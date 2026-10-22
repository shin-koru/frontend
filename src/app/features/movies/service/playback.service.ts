import { effect, inject, Injectable, signal } from '@angular/core';
import { MediaUrls } from '../../../core/uploads/media-urls.service';
import { Movie } from '../model/movie.model';

@Injectable({ providedIn: 'root' })
export class PlaybackService {
  private readonly media = inject(MediaUrls);
  readonly url = signal('');
  readonly loading = signal(false);
  constructor() {
    effect((onCleanup) => {
      const key = this.movie()?.videoObjectKey;
      this.url.set('');
      this.loading.set(!!key);
      if (key) {
        const subscription = this.media.read(key).subscribe((url) => {
          this.url.set(url);
          this.loading.set(false);
        });
        onCleanup(() => subscription.unsubscribe());
      }
    });
  }
  readonly movie = signal<Movie | null>(null);
  open(movie: Movie): void {
    this.movie.set(movie);
  }
  close(): void {
    this.movie.set(null);
  }
}
