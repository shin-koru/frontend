import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FeatureComponent } from '../../../shared/ui/feature.component';
import { MovieCardComponent } from '../../../shared/ui/movie-card.component';
import { ButtonDirective } from '../../../shared/ui/button.directive';
import { ContentStore } from '../state/content.store';

@Component({
  imports: [FeatureComponent, MovieCardComponent, RouterLink, ButtonDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home.component.html',
})
export class HomeComponent implements OnInit {
  readonly catalog = inject(ContentStore);
  ngOnInit(): void {
    this.catalog.load();
  }
}
