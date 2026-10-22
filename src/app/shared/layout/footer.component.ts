import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ModalComponent } from '../ui/modal.component';

@Component({
  selector: 'shin-footer',
  imports: [ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './footer.component.html',
})
export class FooterComponent {
  readonly year = new Date().getFullYear();
  readonly info = signal<string | null>(null);
}
