import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  inject,
  input,
  OnInit,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { UploadManager } from '../../../core/uploads/upload-manager.service';
import { ButtonDirective } from '../../../shared/ui/button.directive';
import { UploadFieldComponent } from '../../../shared/ui/upload-field.component';
import { SeriesApi } from '../service/series.api';
import { Episode, Season } from '../model/series.model';
@Component({
  selector: 'shin-series-manager',
  imports: [FormsModule, ButtonDirective, UploadFieldComponent],
  templateUrl: './series-manager.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SeriesManagerComponent implements OnInit {
  readonly contentId = input.required<string>();
  private readonly api = inject(SeriesApi);
  readonly seasons = signal<Season[]>([]);
  readonly episodes = signal<Episode[]>([]);
  readonly season = signal<Season | null>(null);
  readonly episode = signal<Episode | null>(null);
  readonly seasonEditor = signal(false);
  readonly episodeEditor = signal(false);
  readonly seasonDirty = signal(false);
  readonly episodeDirty = signal(false);
  readonly busy = signal(false);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly message = signal('');
  seasonDraft = { seasonNumber: 1, title: '', description: '' };
  episodeDraft: {
    episodeNumber: number;
    title: string;
    description: string;
    releaseDate: string;
    durationSeconds: string | number | null;
  } = this.emptyEpisode();
  private episodeGeneration = 0;
  constructor() {
    inject(UploadManager)
      .completed$.pipe(takeUntilDestroyed())
      .subscribe((task) => {
        if (task.episodeId && task.result) this.videoSaved(task.episodeId, task.result.objectKey);
      });
  }
  ngOnInit(): void {
    this.loadSeasons();
  }
  emptyEpisode() {
    return { episodeNumber: 1, title: '', description: '', releaseDate: '', durationSeconds: '' };
  }
  hasChanges(): boolean {
    return this.seasonDirty() || this.episodeDirty();
  }
  canLeave(): boolean {
    return (
      !this.busy() &&
      (!this.hasChanges() || window.confirm('Discard unsaved season and episode details?'))
    );
  }
  @HostListener('window:beforeunload', ['$event']) beforeUnload(event: BeforeUnloadEvent): void {
    if (this.hasChanges() || this.busy()) event.preventDefault();
  }
  private feedback(): void {
    this.error.set('');
    this.message.set('');
  }
  loadSeasons(): void {
    this.loading.set(true);
    this.error.set('');
    this.api
      .seasons(this.contentId())
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (data) => this.seasons.set(data.seasons ?? []),
        error: () => this.error.set('Could not load seasons. Please retry.'),
      });
  }
  private clearEpisodes(): void {
    this.episodeGeneration++;
    this.episodes.set([]);
    this.episode.set(null);
    this.episodeEditor.set(false);
    this.episodeDirty.set(false);
  }
  chooseSeason(event: Event): void {
    const select = event.target as HTMLSelectElement;
    if (!this.canLeave()) {
      select.value = this.season()?.id ?? '';
      return;
    }
    const season = this.seasons().find((item) => item.id === select.value);
    this.clearEpisodes();
    this.feedback();
    this.seasonDirty.set(false);
    this.season.set(season ?? null);
    this.seasonEditor.set(!!season);
    if (season) {
      this.seasonDraft = {
        seasonNumber: season.seasonNumber,
        title: season.title ?? '',
        description: season.description ?? '',
      };
      this.loadEpisodes();
    }
  }
  loadEpisodes(): void {
    const id = this.season()?.id;
    if (!id) return;
    const generation = ++this.episodeGeneration;
    this.api.episodes(id).subscribe({
      next: (data) => {
        if (generation === this.episodeGeneration) this.episodes.set(data.episodes ?? []);
      },
      error: () => {
        if (generation === this.episodeGeneration)
          this.error.set('Could not load episodes. Please retry.');
      },
    });
  }
  newSeason(): void {
    if (!this.canLeave()) return;
    this.clearEpisodes();
    this.season.set(null);
    this.seasonEditor.set(true);
    this.seasonDirty.set(false);
    this.feedback();
    this.seasonDraft = {
      seasonNumber: Math.max(0, ...this.seasons().map((item) => item.seasonNumber)) + 1,
      title: '',
      description: '',
    };
  }
  discardSeason(): void {
    const value = this.season();
    if (value)
      this.seasonDraft = {
        seasonNumber: value.seasonNumber,
        title: value.title ?? '',
        description: value.description ?? '',
      };
    else this.seasonEditor.set(false);
    this.seasonDirty.set(false);
    this.feedback();
  }
  saveSeason(): void {
    if (
      this.busy() ||
      !Number.isInteger(this.seasonDraft.seasonNumber) ||
      this.seasonDraft.seasonNumber < 1
    )
      return;
    this.busy.set(true);
    this.feedback();
    this.api
      .saveSeason(this.contentId(), this.season()?.id, {
        ...this.seasonDraft,
        title: this.seasonDraft.title.trim(),
      })
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: (value) => {
          this.seasons.update((items) =>
            [...items.filter((item) => item.id !== value.id), value].sort(
              (a, b) => a.seasonNumber - b.seasonNumber,
            ),
          );
          this.season.set(value);
          this.seasonDirty.set(false);
          this.message.set('Season saved.');
        },
        error: (error) =>
          this.error.set(
            error.status === 409
              ? 'That season number is already used.'
              : 'Could not save the season. Your changes are still here.',
          ),
      });
  }
  chooseEpisode(event: Event): void {
    const select = event.target as HTMLSelectElement;
    if (
      this.busy() ||
      (this.episodeDirty() && !window.confirm('Discard unsaved episode details?'))
    ) {
      select.value = this.episode()?.id ?? '';
      return;
    }
    const value = this.episodes().find((item) => item.id === select.value);
    this.editEpisode(value ?? null);
    this.feedback();
  }
  private editEpisode(value: Episode | null): void {
    this.episode.set(value);
    this.episodeEditor.set(!!value);
    this.episodeDirty.set(false);
    this.episodeDraft = value
      ? {
          episodeNumber: value.episodeNumber,
          title: value.title,
          description: value.description ?? '',
          releaseDate: value.releaseDate?.slice(0, 10) ?? '',
          durationSeconds: value.durationSeconds ?? '',
        }
      : this.emptyEpisode();
  }
  newEpisode(): void {
    if (this.busy() || (this.episodeDirty() && !window.confirm('Discard unsaved episode details?')))
      return;
    this.editEpisode(null);
    this.episodeEditor.set(true);
    this.feedback();
    this.episodeDraft.episodeNumber =
      Math.max(0, ...this.episodes().map((item) => item.episodeNumber)) + 1;
  }
  discardEpisode(): void {
    this.editEpisode(this.episode());
    this.feedback();
  }
  saveEpisode(): void {
    const parent = this.season();
    const draft = this.episodeDraft;
    if (!parent || this.busy() || !draft.title.trim()) return;
    this.busy.set(true);
    this.feedback();
    const details = {
      episodeNumber: draft.episodeNumber,
      title: draft.title.trim(),
      description: draft.description.trim(),
      ...(draft.releaseDate ? { releaseDate: draft.releaseDate } : { clearReleaseDate: true }),
      ...(draft.durationSeconds !== '' && draft.durationSeconds != null
        ? { durationSeconds: Number(draft.durationSeconds) }
        : { clearDurationSeconds: true }),
    };
    this.api
      .saveEpisode(parent.id, this.episode()?.id, details)
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: (value) => {
          this.episodes.update((items) =>
            [...items.filter((item) => item.id !== value.id), value].sort(
              (a, b) => a.episodeNumber - b.episodeNumber,
            ),
          );
          this.editEpisode(value);
          this.message.set('Episode saved. You can upload its video below.');
        },
        error: (error) =>
          this.error.set(
            error.status === 409
              ? 'That episode number is already used.'
              : 'Could not save the episode. Your changes are still here.',
          ),
      });
  }
  videoSaved(id: string, videoKey: string): void {
    this.episodes.update((items) =>
      items.map((item) => (item.id === id ? { ...item, videoKey } : item)),
    );
    if (this.episode()?.id === id) this.episode.set({ ...this.episode()!, videoKey });
  }
  changeStatus(kind: 'season' | 'episode', action: 'publish' | 'archive'): void {
    const item = kind === 'season' ? this.season() : this.episode();
    if (
      !item ||
      this.busy() ||
      this.hasChanges() ||
      (kind === 'episode' && action === 'publish' && !this.episode()?.videoKey)
    )
      return;
    if (
      action === 'archive' &&
      !window.confirm(
        `Archive this ${kind}? It will be hidden from viewers. Details and files will be kept.`,
      )
    )
      return;
    this.busy.set(true);
    this.feedback();
    this.api
      .status(kind, item.id, action)
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: () => {
          const status = action === 'publish' ? 'PUBLISHED' : 'ARCHIVED';
          if (kind === 'season') {
            this.seasons.update((items) =>
              items.map((value) => (value.id === item.id ? { ...value, status } : value)),
            );
            this.season.set({ ...this.season()!, status });
          } else {
            this.episodes.update((items) =>
              items.map((value) => (value.id === item.id ? { ...value, status } : value)),
            );
            this.episode.set({ ...this.episode()!, status });
          }
          this.message.set(
            `${kind === 'season' ? 'Season' : 'Episode'} ${action === 'publish' ? 'published' : 'archived'}.`,
          );
        },
        error: () => this.error.set('Could not change publication status. Please retry.'),
      });
  }
}
