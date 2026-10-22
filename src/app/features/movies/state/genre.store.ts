import { Injectable, inject, signal, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { GenreApi } from '../service/genre.api';
import { Genre } from '../model/genre.model';

@Injectable()
export class GenreStore {
  private readonly api = inject(GenreApi);
  private readonly destroyRef = inject(DestroyRef);
  readonly genres = signal<Genre[]>([]);
  readonly loading = signal(false);
  readonly error = signal(false);
  load(): void {
    if (this.loading()) return;
    this.loading.set(true);
    this.error.set(false);
    this.api
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.genres.set(
            [...(response.genres ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
          );
          this.loading.set(false);
        },
        error: () => {
          this.error.set(true);
          this.loading.set(false);
        },
      });
  }
}
