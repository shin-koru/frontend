import { ChangeDetectionStrategy, Component, computed, inject, DestroyRef } from '@angular/core';
import { toSignal, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged, map } from 'rxjs';
import { MovieCardComponent } from '../../../shared/ui/movie-card.component';
import { ButtonDirective } from '../../../shared/ui/button.directive';
import { ContentStore } from '../state/content.store';
import { GenreStore } from '../state/genre.store';

@Component({
  imports: [MovieCardComponent, ButtonDirective, FormsModule],
  providers: [ContentStore, GenreStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './catalog.component.html',
})
export class CatalogComponent {
  readonly catalog = inject(ContentStore);
  readonly genres = inject(GenreStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly params = toSignal(this.route.queryParamMap);
  readonly query = computed(() => this.params()?.get('q') ?? '');
  readonly type = computed(() => this.params()?.get('type') ?? '');
  readonly year = computed(() => this.params()?.get('year') ?? '');
  readonly sort = computed(() => this.params()?.get('sort') ?? 'title');
  readonly genre = computed(() => this.params()?.get('genre') ?? '');
  readonly unknownGenre = computed(
    () => this.genre() && !this.genres.genres().some((item) => item.id === this.genre()),
  );
  readonly years = Array.from(
    { length: new Date().getFullYear() - 1887 },
    (_, i) => new Date().getFullYear() - i,
  );
  readonly invalid = computed(() => {
    const q = this.query().trim();
    return (
      (q.length > 0 && q.length < 3) ||
      q.length > 120 ||
      (!!this.genre() &&
        (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          this.genre(),
        ) ||
          (!!this.type() && this.type() !== 'movie'))) ||
      (!!this.type() && !['movie', 'series', 'anime', 'cartoon'].includes(this.type())) ||
      (!!this.year() &&
        (!/^\d{4}$/.test(this.year()) || +this.year() < 1888 || +this.year() > 2100)) ||
      !['title', 'newest', 'recent'].includes(this.sort())
    );
  });
  constructor() {
    this.genres.load();
    this.route.queryParamMap
      .pipe(
        map((p) =>
          JSON.stringify([p.get('q'), p.get('type'), p.get('year'), p.get('sort'), p.get('genre')]),
        ),
        distinctUntilChanged(),
        debounceTime(300),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe(() => {
        if (!this.invalid())
          this.catalog.search({
            query: this.query().trim() || undefined,
            type: this.type().toUpperCase() || undefined,
            year: this.year() ? +this.year() : undefined,
            sort: this.sort(),
            genreId: this.genre() || undefined,
          });
      });
  }
  setFilter(key: string, value: string): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        [key]: value || null,
        ...(key === 'genre' && value ? { type: 'movie' } : {}),
        ...(key === 'type' && value !== 'movie' ? { genre: null } : {}),
      },
      queryParamsHandling: 'merge',
      replaceUrl: key === 'q',
    });
  }
  reset(): void {
    void this.router.navigate(['/movies']);
  }
}
