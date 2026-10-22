import { SeriesManagerComponent } from './series-manager.component';
import { HttpClient } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  inject,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { contentCount } from '../service/content.api';
import { ContentItem, ContentPage } from '../model/content.model';
import { UploadFieldComponent } from '../../../shared/ui/upload-field.component';
import { ButtonDirective } from '../../../shared/ui/button.directive';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ContentStore } from '../state/content.store';
import { finalize } from 'rxjs';
import { UploadManager } from '../../../core/uploads/upload-manager.service';

@Component({
  imports: [UploadFieldComponent, ButtonDirective, FormsModule, SeriesManagerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-media.component.html',
})
export class AdminMediaComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly catalog = inject(ContentStore);
  readonly creating = signal(false);
  readonly busy = signal(false);
  readonly message = signal('');
  readonly saveError = signal('');
  readonly dirty = signal(false);
  readonly archivePending = signal(false);
  readonly seriesManager = viewChild(SeriesManagerComponent);
  private loadedCount = 0;
  draft = this.emptyDraft();
  readonly movies = signal<ContentItem[]>([]);
  readonly selected = signal<ContentItem | null>(null);
  readonly loading = signal(false);
  readonly error = signal(false);
  readonly more = signal(true);
  constructor() {
    inject(UploadManager)
      .completed$.pipe(takeUntilDestroyed())
      .subscribe((task) => {
        if (task.contentId && !task.episodeId && task.result && task.purpose !== 'avatar')
          this.saved(
            task.contentId,
            task.purpose === 'poster' ? 'posterObjectKey' : 'videoObjectKey',
            task.result.objectKey,
          );
      });
  }
  ngOnInit(): void {
    this.load();
  }
  statusLabel(status: string | number): string {
    return (
      (
        {
          '0': 'Draft',
          '1': 'Archived',
          '2': 'Published',
          DRAFT: 'Draft',
          ARCHIVED: 'Archived',
          PUBLISHED: 'Published',
        } as Record<string, string>
      )[String(status)] ?? 'Movie'
    );
  }
  load(): void {
    if (this.loading()) return;
    this.loading.set(true);
    this.error.set(false);
    this.http.get<ContentPage>(`/api/content/admin/limit/50/offset/${this.loadedCount}`).subscribe({
      next: (page) => {
        this.loadedCount += page.items?.length ?? 0;
        this.movies.update((items) => [
          ...new Map([...items, ...(page.items ?? [])].map((item) => [item.id, item])).values(),
        ]);
        this.more.set(
          !!page.items?.length && this.loadedCount < contentCount(page.meta?.totalItem),
        );
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      },
    });
  }
  private emptyDraft() {
    return {
      title: '',
      description: '',
      type: 'MOVIE',
      releaseDate: '',
      durationSeconds: '',
      ageRating: '',
    };
  }
  startNew(): void {
    if (!this.canLeave()) return;
    this.selected.set(null);
    this.creating.set(true);
    this.draft = this.emptyDraft();
    this.resetFeedback();
  }
  @HostListener('window:beforeunload', ['$event'])
  beforeUnload(event: BeforeUnloadEvent): void {
    if (this.dirty() || this.busy()) event.preventDefault();
  }
  canLeave(): boolean {
    return (
      !this.busy() &&
      (!this.dirty() || window.confirm('Discard your unsaved movie details?')) &&
      (this.seriesManager()?.canLeave() ?? true)
    );
  }
  private resetFeedback(): void {
    this.dirty.set(false);
    this.message.set('');
    this.saveError.set('');
    this.archivePending.set(false);
  }
  private edit(movie: ContentItem): void {
    this.selected.set(movie);
    this.creating.set(false);
    this.draft = {
      title: movie.title,
      description: movie.description ?? '',
      type: movie.type === 1 || movie.type === 'SERIES' ? 'SERIES' : 'MOVIE',
      releaseDate: movie.releaseDate?.slice(0, 10) ?? '',
      durationSeconds: movie.durationSeconds == null ? '' : String(movie.durationSeconds),
      ageRating: movie.ageRating ?? '',
    };
    this.resetFeedback();
  }
  select(event: Event): void {
    const element = event.target as HTMLSelectElement;
    if (!this.canLeave()) {
      element.value = this.selected()?.id ?? '';
      return;
    }
    const movie = this.movies().find((movie) => movie.id === element.value);
    if (movie) this.edit(movie);
    else {
      this.selected.set(null);
      this.creating.set(false);
      this.resetFeedback();
    }
  }
  discard(): void {
    const movie = this.selected();
    if (movie) this.edit(movie);
    else {
      this.creating.set(false);
      this.resetFeedback();
    }
  }
  save(): void {
    if (this.busy()) return;
    if (
      (this.selected()?.type === 'SERIES' || this.selected()?.type === 1) &&
      this.draft.type !== 'SERIES' &&
      !(this.seriesManager()?.canLeave() ?? true)
    )
      return;
    const value = this.draft;
    if (
      !value.title.trim() ||
      value.title.trim().length > 255 ||
      (value.durationSeconds != null &&
        value.durationSeconds !== '' &&
        (!Number.isInteger(Number(value.durationSeconds)) ||
          Number(value.durationSeconds) < 0 ||
          Number(value.durationSeconds) > 2147483647))
    ) {
      this.saveError.set('Enter a title and a valid runtime in whole seconds.');
      return;
    }
    const movie = this.selected();
    const details = {
      title: value.title.trim(),
      description: value.description.trim(),
      type: value.type,
      ...(value.releaseDate
        ? { releaseDate: `${value.releaseDate}T00:00:00.000Z` }
        : movie
          ? { clearReleaseDate: true }
          : {}),
      ...(value.durationSeconds != null && value.durationSeconds !== ''
        ? { durationSeconds: Number(value.durationSeconds) }
        : movie
          ? { clearDurationSeconds: true }
          : {}),
      ...(value.ageRating.trim()
        ? { ageRating: value.ageRating.trim() }
        : movie
          ? { clearAgeRating: true }
          : {}),
    };
    this.busy.set(true);
    this.saveError.set('');
    this.message.set('');
    const request = movie
      ? this.http.put<ContentItem>(`/api/content/${movie.id}`, details)
      : this.http.post<ContentItem>('/api/content', details);
    request.pipe(finalize(() => this.busy.set(false))).subscribe({
      next: (saved) => {
        this.movies.update((items) =>
          movie ? items.map((item) => (item.id === saved.id ? saved : item)) : [saved, ...items],
        );
        this.edit(saved);
        this.message.set(
          movie
            ? 'Movie details saved.'
            : 'Draft created. You can now upload its poster and video.',
        );
        this.catalog.refresh();
      },
      error: () =>
        this.saveError.set(
          'Movie details could not be saved. Your changes are still here. Please try again.',
        ),
    });
  }
  canPublish(): boolean {
    const movie = this.selected();
    return (
      !!movie?.posterObjectKey &&
      (movie.type === 'SERIES' || movie.type === 1 || !!movie.videoObjectKey) &&
      !this.dirty() &&
      !this.busy() &&
      !this.seriesManager()?.hasChanges() &&
      !this.seriesManager()?.busy()
    );
  }
  changeStatus(action: 'publish' | 'archive'): void {
    const movie = this.selected();
    if (
      !movie ||
      this.busy() ||
      this.dirty() ||
      this.seriesManager()?.hasChanges() ||
      this.seriesManager()?.busy() ||
      (action === 'publish' && !this.canPublish())
    )
      return;
    this.busy.set(true);
    this.saveError.set('');
    this.message.set('');
    const request =
      action === 'publish'
        ? this.http.patch(`/api/content/${movie.id}/publish`, {})
        : this.http.delete(`/api/content/${movie.id}`);
    request.pipe(finalize(() => this.busy.set(false))).subscribe({
      next: () => {
        const status = action === 'publish' ? 'PUBLISHED' : 'ARCHIVED';
        this.movies.update((items) =>
          items.map((item) => (item.id === movie.id ? { ...item, status } : item)),
        );
        this.selected.set(this.movies().find((item) => item.id === movie.id)!);
        this.archivePending.set(false);
        this.message.set(
          action === 'publish'
            ? movie.type === 'SERIES' || movie.type === 1
              ? 'Series published to the catalog.'
              : 'Movie published to the catalog.'
            : 'Movie archived and removed from the catalog.',
        );
        this.catalog.refresh();
      },
      error: () => this.saveError.set('The movie status could not be changed. Please try again.'),
    });
  }
  saved(id: string, field: 'posterObjectKey' | 'videoObjectKey', key: string): void {
    if (this.movies().find((movie) => movie.id === id)?.[field] === key) return;
    this.movies.update((items) =>
      items.map((movie) => (movie.id === id ? { ...movie, [field]: key } : movie)),
    );
    if (this.selected()?.id === id)
      this.selected.set(this.movies().find((movie) => movie.id === id) ?? null);
  }
}
