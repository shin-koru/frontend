import { HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { ConfirmService } from '../../../core/services/confirm.service';
import { ToastService } from '../../../core/services/toast.service';
import { AdminUser, AdminUserFilter, ROLE_LABELS, UserRole } from '../models/user.model';
import { UsersApi } from '../services/users.api';

export const PAGE_SIZE = 20;

const message = (error: HttpErrorResponse, fallback: string) =>
  typeof error.error?.message === 'string' ? error.error.message : fallback;

/** List and detail state for the admin users pages; provided per page. */
@Injectable()
export class UsersStore {
  private readonly api = inject(UsersApi);
  private readonly confirms = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private request?: Subscription;

  readonly items = signal<AdminUser[]>([]);
  readonly selected = signal<AdminUser | null>(null);
  readonly total = signal(0);
  readonly offset = signal(0);
  readonly loading = signal(false);
  readonly error = signal('');
  /** ID of the user whose role or block status is being changed. */
  readonly saving = signal<string | null>(null);
  readonly filter = signal<AdminUserFilter>({ search: '', role: '', blocked: '' });

  load(offset = this.offset()) {
    this.request?.unsubscribe();
    this.loading.set(true);
    this.error.set('');
    this.request = this.api.list(this.filter(), PAGE_SIZE, offset).subscribe({
      next: (page) => {
        this.items.set(page.items);
        this.total.set(page.total);
        this.offset.set(offset);
        this.loading.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(message(error, 'Users could not be loaded.'));
      },
    });
  }

  applyFilter(filter: AdminUserFilter) {
    this.filter.set(filter);
    this.load(0);
  }

  open(id: string) {
    this.request?.unsubscribe();
    this.loading.set(true);
    this.error.set('');
    this.request = this.api.get(id).subscribe({
      next: (user) => {
        this.selected.set(user);
        this.loading.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(
          error.status === 404 ? 'This user does not exist.' : message(error, 'User could not be loaded.'),
        );
      },
    });
  }

  async setRole(user: AdminUser, role: UserRole) {
    if (user.role === role) return;
    const accepted = await this.confirms.confirm({
      header: 'Change role',
      message: `Make ${this.name(user)} ${ROLE_LABELS[role].toLowerCase()}?`,
      acceptLabel: 'Change role',
    });
    if (!accepted) return;
    this.saving.set(user.id);
    this.api.setRole(user.id, role).subscribe({
      next: (updated) => this.updated(updated, `${this.name(updated)} is now ${ROLE_LABELS[role].toLowerCase()}.`),
      error: () => this.saving.set(null),
    });
  }

  async setBlocked(user: AdminUser, blocked: boolean) {
    const accepted = await this.confirms.confirm({
      header: blocked ? 'Block user' : 'Unblock user',
      message: blocked
        ? `Block ${this.name(user)}? They will be signed out everywhere and cannot sign in again until unblocked.`
        : `Unblock ${this.name(user)}? They will be able to sign in again.`,
      acceptLabel: blocked ? 'Block' : 'Unblock',
    });
    if (!accepted) return;
    this.saving.set(user.id);
    this.api.setBlocked(user.id, blocked).subscribe({
      next: (updated) =>
        this.updated(updated, `${this.name(updated)} has been ${blocked ? 'blocked' : 'unblocked'}.`),
      // The error interceptor already shows the server's message.
      error: () => this.saving.set(null),
    });
  }

  name(user: AdminUser) {
    return user.email || user.phone || 'this user';
  }

  private updated(user: AdminUser, notice: string) {
    this.saving.set(null);
    this.items.update((items) => items.map((item) => (item.id === user.id ? user : item)));
    if (this.selected()?.id === user.id) this.selected.set(user);
    this.toast.showSuccessToast(notice);
  }
}
