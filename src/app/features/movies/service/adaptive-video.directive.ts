import { Directive, ElementRef, effect, inject, input, output, signal } from '@angular/core';
import type Hls from 'hls.js';

@Directive({ selector: 'video[shinAdaptiveVideo]', exportAs: 'adaptiveVideo' })
export class AdaptiveVideoDirective {
  readonly shinAdaptiveVideo = input.required<string>();
  readonly format = input('mp4');
  readonly deliveryError = output<number>();
  readonly qualities = signal<{ index: number; height: number }[]>([]);
  readonly selectedQuality = signal(-1);
  private readonly video = inject<ElementRef<HTMLVideoElement>>(ElementRef).nativeElement;
  private hls?: Hls;

  constructor() {
    effect((onCleanup) => {
      const url = this.shinAdaptiveVideo(),
        format = this.format();
      let canceled = false;
      this.qualities.set([]);
      this.selectedQuality.set(-1);
      onCleanup(() => {
        canceled = true;
        this.hls?.destroy();
        this.hls = undefined;
        this.video.pause();
        this.video.removeAttribute('src');
        this.video.load();
      });
      if (!url) return;
      if (format !== 'hls') {
        this.video.src = url;
        return;
      }
      void import('hls.js')
        .then(({ default: Hls }) => {
          if (canceled) return;
          if (!Hls.isSupported()) {
            if (this.video.canPlayType('application/vnd.apple.mpegurl')) this.video.src = url;
            else this.deliveryError.emit(415);
            return;
          }
          const hls = new Hls({
            enableWorker: true,
            maxBufferLength: 20,
            maxMaxBufferLength: 40,
            startLevel: -1,
          });
          this.hls = hls;
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            this.qualities.set(hls.levels.map((level, index) => ({ index, height: level.height })));
          });
          hls.on(Hls.Events.ERROR, (_event, data) => {
            const status = data.response?.code ?? 0;
            if (status === 401 || status === 403 || status === 404 || data.fatal) {
              hls.stopLoad();
              this.deliveryError.emit(status);
            }
          });
          hls.loadSource(url);
          hls.attachMedia(this.video);
        })
        .catch(() => {
          if (!canceled) this.deliveryError.emit(0);
        });
    });
  }
  selectQuality(value: string): void {
    const level = Number(value);
    if (!this.hls || !Number.isInteger(level) || level < -1 || level >= this.hls.levels.length)
      return;
    this.selectedQuality.set(level);
    this.hls.nextLevel = level;
  }
}
