import {
  ChangeDetectionStrategy,
  Component,
  effect,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { ModalComponent } from '../../../shared/ui/modal.component';
import { ProfileStore } from '../state/profile.store';
import { AuthStore } from '../../auth/state/auth.store';
import { MovieCardComponent } from '../../../shared/ui/movie-card.component';
import { ButtonDirective } from '../../../shared/ui/button.directive';
import { WatchlistStore } from '../../movies/state/watchlist.store';
import { UploadFieldComponent } from '../../../shared/ui/upload-field.component';
import { MediaUrls } from '../../../core/uploads/media-urls.service';

@Component({
  imports: [MovieCardComponent, ButtonDirective, RouterLink, ModalComponent, UploadFieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './profile.component.html',
})
export class ProfileComponent implements OnInit {
  private readonly media = inject(MediaUrls);
  readonly avatarUrl = signal('');
  private readonly store = inject(ProfileStore);
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);
  readonly profile = toSignal(this.store.profile$);
  readonly loading = toSignal(this.store.loading$, { initialValue: false });
  readonly failed = signal(false);
  readonly loggingOut = signal(false);
  readonly info = signal<string | null>(null);
  readonly watchlist = inject(WatchlistStore);
  readonly fullName = computed(
    () =>
      [this.profile()?.firstName, this.profile()?.lastName].filter(Boolean).join(' ') ||
      this.profile()?.username ||
      'SHIN member',
  );
  readonly initials = computed(() =>
    this.fullName()
      .split(' ')
      .map((word) => word[0])
      .slice(0, 2)
      .join('')
      .toUpperCase(),
  );
  readonly tabs = ['My watchlist', 'Account settings', 'Membership'] as const;
  readonly tab = signal<(typeof this.tabs)[number]>('My watchlist');
  constructor() {
    effect((onCleanup) => {
      const key = this.profile()?.avatarKey;
      this.avatarUrl.set('');
      if (key) {
        const subscription = this.media
          .read(key, 'private')
          .subscribe((url) => this.avatarUrl.set(url));
        onCleanup(() => subscription.unsubscribe());
      }
    });
  }
  ngOnInit(): void {
    this.loadProfile();
  }
  loadProfile(): void {
    this.failed.set(false);
    this.store.getProfileMe().subscribe({
      error: (error: HttpErrorResponse) => {
        if (error.status === 404) void this.router.navigate(['/profile/create']);
        else this.failed.set(true);
      },
    });
  }
  logout(): void {
    this.loggingOut.set(true);
    this.auth.logout().subscribe({
      next: () => void this.router.navigate(['/auth/login']),
      error: () => this.loggingOut.set(false),
    });
  }
}
