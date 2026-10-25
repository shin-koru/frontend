import { HttpClient, HttpContext } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  signal,
  DestroyRef,
} from '@angular/core';
import { Subscription } from 'rxjs';
import { SILENT_HTTP_ERROR } from '../../../core/interceptors/http-context';
import { ButtonDirective } from '../../../shared/ui/button.directive';
import { Season, Episode } from '../model/series.model';
import { PlaybackService } from '../service/playback.service';
@Component({
  selector: 'shin-episodes',
  imports: [ButtonDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: ` <section id="episodes" class="surface episode-list stack" aria-label="Episodes">
    <h2>Episodes</h2>
    @if (error()) {
      <p role="alert" class="field-error">Episodes couldn’t load. Please try again.</p>
      <button shinButton variant="secondary" (click)="load()">Try again</button>
    }
    @if (seasons().length) {
      <label
        >Season
        <select [value]="selected()" (change)="choose($event)">
          @for (season of seasons(); track season.id) {
            <option [value]="season.id">
              Season {{ season.seasonNumber }}{{ season.title ? ' · ' + season.title : '' }}
            </option>
          }
        </select></label
      >
    }
    @if (loading()) {
      <p role="status">Loading episodes…</p>
    } @else if (!error() && !episodes().length) {
      <p class="muted">No published episodes are available yet.</p>
    }
    <div class="activity-grid">
      @for (episode of episodes(); track episode.id) {
        <article class="activity-card stack">
          <p class="eyebrow accent">Episode {{ episode.episodeNumber }}</p>
          <h3>{{ episode.title }}</h3>
          <p class="muted">{{ episode.description }}</p>
          <button
            shinButton
            (click)="playback.open({ slug: episode.id, title: episode.title }, 'episode')"
          >
            Watch episode {{ episode.episodeNumber }}
          </button>
        </article>
      }
    </div>
  </section>`,
})
export class EpisodesComponent {
  readonly contentId = input.required<string>();
  readonly seasons = signal<Season[]>([]);
  readonly episodes = signal<Episode[]>([]);
  readonly selected = signal('');
  readonly loading = signal(false);
  readonly error = signal(false);
  readonly playback = inject(PlaybackService);
  private readonly http = inject(HttpClient);
  private request?: Subscription;
  private episodeRequest?: Subscription;
  private generation = 0;
  constructor() {
    effect(() => {
      this.contentId();
      this.load();
    });
    inject(DestroyRef).onDestroy(() => {
      this.request?.unsubscribe();
      this.episodeRequest?.unsubscribe();
    });
  }
  load() {
    const id = this.contentId();
    this.request?.unsubscribe();
    this.episodeRequest?.unsubscribe();
    const generation = ++this.generation;
    this.seasons.set([]);
    this.episodes.set([]);
    this.loading.set(true);
    this.error.set(false);
    this.request = this.http
      .get<{ seasons?: Season[] }>(`/api/content/${encodeURIComponent(id)}/season`, {
        context: new HttpContext().set(SILENT_HTTP_ERROR, true),
      })
      .subscribe({
        next: (r) => {
          if (generation !== this.generation) return;
          const seasons = (r.seasons ?? []).sort((a, b) => a.seasonNumber - b.seasonNumber);
          this.seasons.set(seasons);
          if (seasons[0]) this.loadEpisodes(seasons[0].id);
          else this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.error.set(true);
        },
      });
  }
  choose(event: Event) {
    if (event.target instanceof HTMLSelectElement) this.loadEpisodes(event.target.value);
  }
  private loadEpisodes(id: string) {
    this.episodeRequest?.unsubscribe();
    this.selected.set(id);
    this.episodes.set([]);
    this.loading.set(true);
    this.error.set(false);
    this.episodeRequest = this.http
      .get<{ episodes?: Episode[] }>(`/api/season/${encodeURIComponent(id)}/episode`, {
        context: new HttpContext().set(SILENT_HTTP_ERROR, true),
      })
      .subscribe({
        next: (r) => {
          this.episodes.set((r.episodes ?? []).sort((a, b) => a.episodeNumber - b.episodeNumber));
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.error.set(true);
        },
      });
  }
}
