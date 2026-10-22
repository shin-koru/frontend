import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ModalComponent } from './shared/ui/modal.component';
import { NotificationsComponent } from './shared/ui/notifications.component';
import { HeaderComponent } from './shared/layout/header.component';
import { FooterComponent } from './shared/layout/footer.component';
import { PlaybackService } from './features/movies/service/playback.service';
import { WatchlistStore } from './features/movies/state/watchlist.store';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { UploadManager } from './core/uploads/upload-manager.service';
import { ProfileStore } from './features/profile/state/profile.store';
import { ContentStore } from './features/movies/state/content.store';
import { AdaptiveVideoDirective } from './features/movies/service/adaptive-video.directive';

@Component({
  imports: [
    RouterOutlet,
    ModalComponent,
    NotificationsComponent,
    HeaderComponent,
    FooterComponent,
    AdaptiveVideoDirective,
  ],
  selector: 'app-root',
  templateUrl: './app.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  readonly playback = inject(PlaybackService);
  readonly watchlist = inject(WatchlistStore);
  constructor() {
    const profiles = inject(ProfileStore);
    const catalog = inject(ContentStore);
    inject(UploadManager)
      .completed$.pipe(takeUntilDestroyed())
      .subscribe((task) => {
        if (task.purpose === 'avatar') profiles.getProfileMe().subscribe({ error: () => {} });
        else catalog.refresh();
      });
  }
}
