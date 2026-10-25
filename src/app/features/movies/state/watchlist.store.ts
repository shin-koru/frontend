import { computed, DestroyRef, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { Subscription } from 'rxjs';
import { SessionService } from '../../../core/services/session.service';
import { ActivityApi, ActivityItem, sessionAccount } from '../service/activity.api';
export const isContentId = (id: unknown): id is string =>
  typeof id === 'string' && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id);
@Injectable({ providedIn: 'root' })
export class WatchlistStore {
  private readonly api = inject(ActivityApi);
  private readonly session = inject(SessionService);
  private owner = '';
  private generation = 0;
  private requests = new Subscription();
  private pageRequest?: Subscription;
  private offset = 0;
  private total = 0;
  readonly items = signal<readonly ActivityItem[]>([]);
  readonly states = signal<ReadonlyMap<string, boolean>>(new Map());
  readonly pending = signal<ReadonlySet<string>>(new Set());
  readonly loading = signal(false);
  readonly error = signal(false);
  readonly notice = signal('');
  readonly hasMore = signal(false);
  readonly ids = computed(() => [...this.states()].filter(([, saved]) => saved).map(([id]) => id));
  constructor() {
    effect(() => {
      const owner = sessionAccount(this.session.token());
      untracked(() => {
        if (owner === this.owner) return;
        this.owner = owner;
        this.generation++;
        this.requests.unsubscribe();
        this.requests = new Subscription();
        this.pageRequest?.unsubscribe();
        this.items.set([]);
        this.states.set(new Map());
        this.pending.set(new Set());
        this.loading.set(false);
        this.notice.set('');
        this.error.set(false);
        this.offset = 0;
        this.total = 0;
        this.hasMore.set(false);
        if (owner) this.load(true);
      });
    });
    inject(DestroyRef).onDestroy(() => {
      this.requests.unsubscribe();
      this.pageRequest?.unsubscribe();
    });
  }
  has(id: string) {
    return this.states().get(id) ?? false;
  }
  busy(id: string) {
    return this.pending().has(id);
  }
  known(id: string) {
    return this.states().has(id);
  }
  private busySet(id: string, value: boolean) {
    this.pending.update((old) => {
      const next = new Set(old);
      if (value) next.add(id);
      else next.delete(id);
      return next;
    });
  }
  ensure(id: string) {
    if (!this.owner || !isContentId(id) || this.known(id) || this.busy(id)) return;
    this.busySet(id, true);
    const generation = this.generation;
    this.requests.add(
      this.api.status(id).subscribe({
        next: (r) => {
          if (generation !== this.generation) return;
          this.states.update((old) => new Map(old).set(id, r.favorite));
          this.busySet(id, false);
        },
        error: () => {
          if (generation === this.generation) {
            this.busySet(id, false);
            this.notice.set('Saved status couldn’t load. Select My list to retry.');
          }
        },
      }),
    );
  }
  toggle(id: string) {
    if (!this.owner || !isContentId(id) || this.busy(id)) return;
    if (!this.known(id)) {
      this.ensure(id);
      return;
    }
    const add = !this.has(id),
      generation = this.generation;
    this.busySet(id, true);
    this.notice.set('');
    this.requests.add(
      this.api.favorite(id, add).subscribe({
        next: (r) => {
          if (generation !== this.generation) return;
          this.states.update((old) => new Map(old).set(id, r.favorite));
          this.busySet(id, false);
          this.notice.set(r.favorite ? 'Added to your list.' : 'Removed from your list.');
          this.load(true);
        },
        error: () => {
          if (generation === this.generation) {
            this.busySet(id, false);
            this.notice.set('Your list couldn’t be updated. Please try again.');
          }
        },
      }),
    );
  }
  load(reset = false) {
    if (!this.owner || (!reset && this.loading())) return;
    this.pageRequest?.unsubscribe();
    if (reset) {
      this.offset = 0;
      this.items.set([]);
    }
    this.loading.set(true);
    this.error.set(false);
    const generation = this.generation,
      offset = this.offset;
    this.pageRequest = this.api.page('favorites', offset).subscribe({
      next: (page) => {
        if (generation !== this.generation) return;
        const items = page.items ?? [];
        this.items.update((old) => [...old, ...items]);
        this.states.update((old) => {
          const next = new Map(old);
          for (const item of items) next.set(item.contentId, true);
          return next;
        });
        this.offset += items.length;
        this.total = Number(page.meta?.totalItem ?? this.offset);
        this.hasMore.set(items.length > 0 && this.offset < this.total && this.offset <= 100000);
        this.loading.set(false);
      },
      error: () => {
        if (generation === this.generation) {
          this.loading.set(false);
          this.error.set(true);
        }
      },
    });
  }
}
