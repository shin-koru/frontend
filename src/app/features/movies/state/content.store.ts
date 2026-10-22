import { computed, effect, inject, Injectable, signal, DestroyRef } from '@angular/core';
import { Subscription } from 'rxjs';
import { SessionService } from '../../../core/services/session.service';
import { ContentApi, contentCount, published, toMovie } from '../service/content.api';
import { ContentFilters } from '../model/content.model';
import { Movie } from '../model/movie.model';

@Injectable({ providedIn: 'root' })
export class ContentStore {
  private readonly api = inject(ContentApi);
  readonly session = inject(SessionService);
  readonly movies = signal<readonly Movie[]>([]);
  readonly loading = signal(false);
  readonly error = signal(false);
  readonly loaded = signal(false);
  readonly offset = signal(0);
  readonly total = signal(0);
  readonly hasMore = computed(() => this.offset() < this.total() && this.offset() <= 10000);
  readonly needsRefinement = computed(() => this.offset() > 10000 && this.offset() < this.total());
  private generation = 0;
  private filters: ContentFilters = {};
  private pending?: Subscription;
  constructor() {
    inject(DestroyRef).onDestroy(() => this.pending?.unsubscribe());
    effect(() => {
      const token = this.session.token();
      if (!token) {
        this.generation++;
        this.movies.set([]);
        this.loaded.set(false);
        this.offset.set(0);
        this.total.set(0);
        this.loading.set(false);
      }
    });
  }
  search(filters: ContentFilters): void {
    this.pending?.unsubscribe();
    this.filters = filters;
    this.generation++;
    this.movies.set([]);
    this.offset.set(0);
    this.total.set(0);
    this.loaded.set(false);
    this.loading.set(false);
    this.error.set(false);
    this.load();
  }
  load(): void {
    if (!this.loaded() && !this.loading() && this.session.token()) this.loadMore();
  }
  refresh(): void {
    const wasLoaded = this.loaded();
    this.generation++;
    this.movies.set([]);
    this.offset.set(0);
    this.total.set(0);
    this.loaded.set(false);
    this.loading.set(false);
    if (wasLoaded) this.load();
  }
  loadMore(): void {
    if (this.loading() || !this.session.token()) return;
    this.loading.set(true);
    this.error.set(false);
    const generation = this.generation;
    this.pending = this.api.page(12, this.offset(), this.filters).subscribe({
      next: (page) => {
        if (generation !== this.generation) return;
        const items = page.items ?? [];
        const next = new Map(this.movies().map((movie) => [movie.slug, movie]));
        for (const item of items.filter(published)) next.set(item.id, toMovie(item));
        this.movies.set([...next.values()]);
        this.offset.update((value) => value + items.length);
        this.total.set(page.meta ? contentCount(page.meta.totalItem) : this.offset());
        if (!items.length) this.total.set(this.offset());
        this.loaded.set(true);
        this.loading.set(false);
      },
      error: () => {
        if (generation === this.generation) {
          this.error.set(true);
          this.loading.set(false);
        }
      },
    });
  }
}
