import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ActivityListComponent } from './activity-list.component';
@Component({
  imports: [ActivityListComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<main id="main-content" class="page">
    <h1>Your viewing story.</h1>
    <p class="muted">Pick up where you left off or revisit a favorite moment.</p>
    <shin-activity-list mode="continue" /><shin-activity-list mode="history" />
  </main>`,
})
export class HistoryComponent {}
