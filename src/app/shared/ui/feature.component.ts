import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { MediaUrls } from '../../core/uploads/media-urls.service';
import { RouterLink } from '@angular/router';
import { ButtonDirective } from './button.directive';
import { Movie } from '../../features/movies/model/movie.model';
import { WatchlistStore } from '../../features/movies/state/watchlist.store';
import { PlaybackService } from '../../features/movies/service/playback.service';

@Component({
  selector: 'shin-feature',
  imports: [RouterLink, ButtonDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './feature.component.html',
})
export class FeatureComponent {
  private readonly media = inject(MediaUrls);
  readonly posterUrl = signal<string | undefined>(undefined);
  readonly failedPoster = signal<string | undefined>(undefined);
  readonly movie = input.required<Movie>();
  readonly details = input(false);
  readonly watchlist = inject(WatchlistStore);
  readonly playback = inject(PlaybackService);
  constructor() {
    effect((onCleanup) => {
      const movie = this.movie();
      this.posterUrl.set(movie.posterUrl);
      if (movie.posterObjectKey) {
        const subscription = this.media
          .read(movie.posterObjectKey)
          .subscribe((url) => this.posterUrl.set(url || undefined));
        onCleanup(() => subscription.unsubscribe());
      }
    });
  }
}
