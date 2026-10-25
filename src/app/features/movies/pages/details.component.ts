import { EpisodesComponent } from './episodes.component';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, combineLatest, of, switchMap, tap } from 'rxjs';
import { FeatureComponent } from '../../../shared/ui/feature.component';
import { MovieCardComponent } from '../../../shared/ui/movie-card.component';
import { ButtonDirective } from '../../../shared/ui/button.directive';
import { ContentApi } from '../service/content.api';
import { ContentStore } from '../state/content.store';
import { Movie } from '../model/movie.model';

@Component({
  imports: [EpisodesComponent, FeatureComponent, MovieCardComponent, RouterLink, ButtonDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './details.component.html',
})
export class DetailsComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(ContentApi);
  readonly catalog = inject(ContentStore);
  readonly movie = signal<Movie | null>(null);
  readonly loading = signal(true);
  readonly error = signal(false);
  readonly related = computed(() =>
    this.catalog
      .movies()
      .filter((m) => m.slug !== this.movie()?.slug)
      .slice(0, 6),
  );
  readonly tabs = ['Overview', 'Trailers', 'Reviews'] as const;
  readonly tab = signal<(typeof this.tabs)[number]>('Overview');
  constructor() {
    combineLatest([this.route.paramMap, this.route.queryParamMap])
      .pipe(
        tap(() => {
          this.loading.set(true);
          this.error.set(false);
          this.movie.set(null);
          this.tab.set('Overview');
        }),
        switchMap(([params, query]) => {
          const id = params.get('slug') ?? '';
          if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)) return of(null);
          return this.api.detail(id, query.get('type') ?? undefined).pipe(
            catchError((error) => {
              this.error.set(error.status !== 404);
              return of(null);
            }),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe((movie) => {
        this.movie.set(movie);
        this.loading.set(false);
      });
  }
  ngOnInit(): void {
    this.catalog.load();
  }
}
