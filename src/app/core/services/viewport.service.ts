import { afterNextRender, DestroyRef, inject, Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ViewportService {
  readonly mobile = signal(false);
  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const media = window.matchMedia('(max-width: 600px)');
      const update = () => this.mobile.set(media.matches);
      update();
      media.addEventListener('change', update);
      destroyRef.onDestroy(() => media.removeEventListener('change', update));
    });
  }
}
