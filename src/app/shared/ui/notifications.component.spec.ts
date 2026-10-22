import { TestBed } from '@angular/core/testing';
import { ConfirmationService, MessageService } from 'primeng/api';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationsComponent } from './notifications.component';

describe('Native notification and legacy confirmation bridge', () => {
  let component: NotificationsComponent;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [MessageService, ConfirmationService] });
    component = TestBed.runInInjectionContext(() => new NotificationsComponent());
  });
  it('displays and clears existing toast-service messages', () => {
    const messages = TestBed.inject(MessageService);
    messages.add({ severity: 'success', summary: 'Saved', detail: 'Your changes were saved.' });
    expect(component.notice()?.detail).toBe('Your changes were saved.');
    messages.clear();
    expect(component.notice()).toBeNull();
  });
  it('runs the legacy accept callback once and closes the confirmation', () => {
    const accept = vi.fn();
    TestBed.inject(ConfirmationService).confirm({ message: 'Delete user?', accept });
    component.accept();
    expect(accept).toHaveBeenCalledOnce();
    expect(component.confirmation()).toBeNull();
  });
  it('cancels a confirmation without accepting a destructive action', () => {
    const accept = vi.fn();
    const reject = vi.fn();
    TestBed.inject(ConfirmationService).confirm({ message: 'Delete user?', accept, reject });
    component.reject();
    expect(reject).toHaveBeenCalledOnce();
    expect(accept).not.toHaveBeenCalled();
    expect(component.confirmation()).toBeNull();
  });
});
