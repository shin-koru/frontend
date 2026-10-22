import { Directive, input } from '@angular/core';

@Directive({
  selector: 'button[shinButton], a[shinButton]',
  host: { class: 'shin-button', '[class.secondary]': 'variant() === "secondary"' },
})
export class ButtonDirective {
  readonly variant = input<'primary' | 'secondary'>('primary');
}
