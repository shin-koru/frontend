import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { ConfirmService } from '../../core/services/confirm.service';
import { ToastService } from '../../core/services/toast.service';
import { NotificationsComponent } from './notifications.component';

describe('Notifications and confirmations', () => {
  let component: NotificationsComponent;
  beforeEach(() => {
    TestBed.configureTestingModule({});
    component = TestBed.runInInjectionContext(() => new NotificationsComponent());
  });
  it('displays and clears toast-service messages', () => {
    const toasts = TestBed.inject(ToastService);
    toasts.showSuccessToast('Your changes were saved.');
    expect(component.notice()?.detail).toBe('Your changes were saved.');
    component.dismiss();
    expect(component.notice()).toBeNull();
  });
  it('resolves true once when accepted and closes the dialog', async () => {
    const answer = TestBed.inject(ConfirmService).confirm({ message: 'Block user?' });
    expect(component.confirmation()?.message).toBe('Block user?');
    component.accept();
    component.accept();
    await expect(answer).resolves.toBe(true);
    expect(component.confirmation()).toBeNull();
  });
  it('resolves false when cancelled', async () => {
    const answer = TestBed.inject(ConfirmService).confirm({ message: 'Block user?' });
    component.reject();
    await expect(answer).resolves.toBe(false);
    expect(component.confirmation()).toBeNull();
  });
  it('cancels an unanswered question when a new one is asked', async () => {
    const confirms = TestBed.inject(ConfirmService);
    const first = confirms.confirm({ message: 'First?' });
    confirms.confirm({ message: 'Second?' });
    await expect(first).resolves.toBe(false);
    expect(component.confirmation()?.message).toBe('Second?');
  });
});
