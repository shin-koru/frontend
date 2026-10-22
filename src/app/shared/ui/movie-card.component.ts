import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { MediaUrls } from '../../core/uploads/media-urls.service';
import { RouterLink } from '@angular/router';
import { Movie } from '../../features/movies/model/movie.model';

@Component({
  selector: 'shin-movie-card',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './movie-card.component.html',
})
export class MovieCardComponent {
  private readonly media = inject(MediaUrls);
  readonly posterUrl = signal<string | undefined>(undefined);
  readonly failedPoster = signal<string | undefined>(undefined);
  readonly movie = input.required<Movie>();
  readonly removable = input(false);
  readonly remove = output<string>();
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
