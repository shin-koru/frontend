import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { catchError, forkJoin, of } from 'rxjs';
import { StorageService } from '../../../core/services/storage.service';
import { SessionService } from '../../../core/services/session.service';
import { ContentApi } from '../service/content.api';
import { Movie } from '../model/movie.model';

export const isContentId = (id: unknown): id is string =>
  typeof id === 'string' && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id);
@Injectable({ providedIn: 'root' })
export class WatchlistStore {
  private readonly storage = inject(StorageService);
  private readonly session = inject(SessionService);
  private readonly api = inject(ContentApi);
  private owner = '';
  readonly ids = signal<readonly string[]>([]);
  readonly movies = signal<readonly Movie[]>([]);
  readonly loading = signal(false);
  readonly error = signal(false);
  readonly notice = signal('');
  constructor() {
    effect(() => {
      const token = this.session.token();
      let owner = '';
      try {
        owner = token
          ? (JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).sub ?? '')
          : '';
      } catch {
        /* Invalid session data is never used as an account ID. */
      }
      if (owner === this.owner) return;
      this.owner = owner;
      let ids: unknown = [];
      try {
        ids = JSON.parse(this.storage.getItem(this.key) ?? '[]');
      } catch {
        /* Corrupted lists start empty. */
      }
      this.ids.set(owner && Array.isArray(ids) ? [...new Set(ids.filter(isContentId))] : []);
      this.movies.set([]);
    });
    effect((onCleanup) => {
      const ids = this.ids();
      if (!ids.length || !this.session.token()) {
        this.movies.set([]);
        this.loading.set(false);
        return;
      }
      this.loading.set(true);
      this.error.set(false);
      const subscription = forkJoin(
        ids.map((id) =>
          this.api.detail(id).pipe(
            catchError((error) => {
              if (error.status !== 404) this.error.set(true);
              return of(null);
            }),
          ),
        ),
      ).subscribe((movies) => {
        this.movies.set(movies.filter((movie): movie is Movie => !!movie));
        this.loading.set(false);
      });
      onCleanup(() => subscription.unsubscribe());
    });
  }
  private get key(): string {
    return 'shin.watchlist.v2.' + this.owner;
  }
  has(id: string): boolean {
    return this.ids().includes(id);
  }
  toggle(id: string): void {
    if (!this.owner || !isContentId(id)) return;
    const removing = this.has(id);
    const ids = removing ? this.ids().filter((item) => item !== id) : [...this.ids(), id];
    this.ids.set(ids);
    try {
      this.storage.setItem(this.key, JSON.stringify(ids));
    } catch {
      this.notice.set('Your list changed, but it could not be saved on this browser.');
      return;
    }
    this.notice.set(removing ? 'Removed from your watchlist.' : 'Added to your watchlist.');
  }
}
