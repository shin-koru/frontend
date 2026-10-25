import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { SessionService } from '../../../core/services/session.service';
import { ButtonDirective } from '../../../shared/ui/button.directive';
import { ActivityApi, ActivityItem, sessionAccount } from '../service/activity.api';
import { PlaybackService } from '../service/playback.service';
import { WatchlistStore } from '../state/watchlist.store';
@Component({
  selector: 'shin-activity-list',
  imports: [RouterLink, ButtonDirective, DatePipe],
  templateUrl: './activity-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActivityListComponent {
  readonly mode = input<'favorites' | 'history' | 'continue'>('continue');
  readonly compact = input(false);
  readonly favorites = inject(WatchlistStore);
  readonly playback = inject(PlaybackService);
  private readonly api = inject(ActivityApi);
  private readonly session = inject(SessionService);
  readonly items = signal<ActivityItem[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly more = signal(false);
  readonly confirming = signal(false);
  readonly deleting = signal(false);
  private owner = '';
  private offset = 0;
  private generation = 0;
  private request?: Subscription;
  private mutation?: Subscription;
  constructor() {
    effect(() => {
      const owner = sessionAccount(this.session.token());
      const mode = this.mode();
      this.api.revision();
      untracked(() => {
        if (owner !== this.owner) {
          this.owner = owner;
          this.confirming.set(false);
          this.deleting.set(false);
          this.mutation?.unsubscribe();
        }
        this.generation++;
        this.request?.unsubscribe();
        this.items.set([]);
        this.offset = 0;
        this.more.set(false);
        this.error.set('');
        this.loading.set(false);
        if (owner && mode !== 'favorites') this.load();
      });
    });
    inject(DestroyRef).onDestroy(() => {
      this.request?.unsubscribe();
      this.mutation?.unsubscribe();
    });
  }
  load(reset = false) {
    if (this.loading()) return;
    if (reset) {
      this.offset = 0;
      this.items.set([]);
    }
    this.loading.set(true);
    this.error.set('');
    const generation = this.generation;
    this.request = this.api.page(this.mode(), this.offset, this.compact() ? 6 : 12).subscribe({
      next: (page) => {
        if (generation !== this.generation) return;
        const rows = page.items ?? [];
        this.items.update((old) => [...old, ...rows]);
        this.offset += rows.length;
        this.more.set(
          rows.length > 0 &&
            this.offset < Number(page.meta?.totalItem ?? 0) &&
            this.offset <= 100000,
        );
        this.loading.set(false);
      },
      error: () => {
        if (generation === this.generation) {
          this.loading.set(false);
          this.error.set('Your activity couldn’t load. Please try again.');
        }
      },
    });
  }
  entries() {
    return this.mode() === 'favorites' ? this.favorites.items() : this.items();
  }
  label(item: ActivityItem) {
    return item.parentTitle
      ? `${item.parentTitle} · Season ${item.seasonNumber}, episode ${item.episodeNumber}`
      : '';
  }
  position(item: ActivityItem) {
    const seconds = Math.floor(item.positionSeconds ?? 0);
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  }
  percent(item: ActivityItem) {
    return item.durationSeconds
      ? Math.min(100, (100 * (item.positionSeconds ?? 0)) / item.durationSeconds)
      : 0;
  }
  remove(item: ActivityItem) {
    if (this.deleting()) return;
    this.playback.forget(item.contentId, item.kind);
    this.mutate(this.api.remove(item.contentId, item.kind));
  }
  clear() {
    if (this.deleting()) return;
    this.playback.forget();
    this.mutate(this.api.clear());
  }
  private mutate(operation: ReturnType<ActivityApi['clear']>) {
    this.deleting.set(true);
    const owner = sessionAccount(this.session.token());
    this.mutation = operation.subscribe({
      next: () => {
        this.deleting.set(false);
        this.confirming.set(false);
        if (owner === sessionAccount(this.session.token())) this.api.changed();
      },
      error: () => {
        this.deleting.set(false);
        if (owner === sessionAccount(this.session.token()))
          this.error.set('Your history couldn’t be changed. Please try again.');
      },
    });
  }
}
