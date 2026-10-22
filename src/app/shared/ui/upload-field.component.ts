import { ChangeDetectionStrategy, Component, effect, inject, input, output } from '@angular/core';
import { UploadManager } from '../../core/uploads/upload-manager.service';
import { UploadPurpose } from '../../core/uploads/upload.model';
import { ButtonDirective } from './button.directive';

@Component({
  selector: 'shin-upload-field',
  imports: [ButtonDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: ` <section class="upload-field stack" [attr.aria-label]="label() + ' upload'">
    <div>
      <h3>{{ label() }}</h3>
      <p class="muted">
        {{
          purpose() === 'video'
            ? 'MP4, WebM or MOV · up to 100 GiB. Videos resume after interruption.'
            : purpose() === 'avatar'
              ? 'JPG, PNG, GIF or WebP · up to 5 MiB. Visible only on your account.'
              : 'JPG, PNG, GIF or WebP · up to 20 MiB.'
        }}
      </p>
    </div>
    <label class="file-picker"
      >{{
        uploads.record(taskKey())?.status === 'paused'
          ? 'Select original file to resume'
          : 'Choose ' + (purpose() === 'video' ? 'video' : 'image')
      }}
      <input
        type="file"
        [attr.aria-label]="label()"
        [accept]="
          purpose() === 'video'
            ? 'video/mp4,video/webm,video/quicktime,.mov'
            : 'image/jpeg,image/png,image/gif,image/webp'
        "
        [disabled]="uploads.busy(taskKey())"
        (change)="choose($event)"
      />
    </label>
    @if (uploads.record(taskKey()); as task) {
      <p class="upload-name">{{ task.name }}</p>
      <p role="status" aria-live="polite">{{ message(task.status) }}</p>
      @if (['hashing', 'uploading', 'paused', 'verifying', 'saving'].includes(task.status)) {
        <progress
          max="100"
          [value]="task.progress"
          [attr.aria-label]="task.status === 'hashing' ? 'Checksum progress' : 'Upload progress'"
        ></progress>
        <span class="muted"
          >{{ task.progress }}% {{ task.status === 'hashing' ? 'checked' : 'transferred' }}</span
        >
      }
      @if (task.error) {
        <p class="field-error" role="alert">{{ task.error }}</p>
      }
      <div class="upload-actions">
        @if (purpose() === 'video' && ['hashing', 'uploading'].includes(task.status)) {
          <button shinButton variant="secondary" (click)="uploads.pause(taskKey())">
            Pause upload
          </button>
        }
        @if (
          ['paused', 'error'].includes(task.status) &&
          (uploads.hasFile(taskKey()) || task.result || task.sessionId)
        ) {
          <button shinButton (click)="uploads.resume(taskKey())">Resume upload</button>
        }
        @if (['ready', 'hashing', 'uploading', 'paused', 'error'].includes(task.status)) {
          <button shinButton variant="secondary" (click)="uploads.cancel(taskKey())">
            Cancel upload
          </button>
        }
      </div>
    }
  </section>`,
})
export class UploadFieldComponent {
  readonly uploads = inject(UploadManager);
  readonly taskKey = input.required<string>();
  readonly purpose = input.required<UploadPurpose>();
  readonly contentId = input<string>();
  readonly episodeId = input<string>();
  readonly label = input.required<string>();
  readonly saved = output<string>();
  private observedKey = '';
  private previousStatus?: string;
  constructor() {
    effect(() => {
      const key = this.taskKey();
      const task = this.uploads.record(key);
      const previous = this.observedKey === key ? this.previousStatus : undefined;
      this.observedKey = key;
      this.previousStatus = task?.status;
      if (task?.status === 'complete' && task.result && previous && previous !== 'complete') {
        this.saved.emit(task.result.objectKey);
      }
    });
  }
  choose(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file)
      void this.uploads.select(
        this.taskKey(),
        this.purpose(),
        file,
        this.contentId(),
        this.episodeId(),
      );
    input.value = '';
  }
  message(status: string): string {
    return (
      (
        {
          ready: 'Ready to upload',
          hashing: 'Checking video before upload…',
          uploading: 'Uploading…',
          paused: 'Upload paused. Completed video parts are saved.',
          verifying:
            'Verifying video integrity. Keep this page open or return to check its status.',
          saving: 'Saving to your account…',
          complete: 'Upload saved successfully.',
          error: 'Upload needs attention.',
          cancelling: 'Cancelling upload…',
          cancelled: 'Upload cancelled. You can choose another file.',
        } as Record<string, string>
      )[status] ?? status
    );
  }
}
