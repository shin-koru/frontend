import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { ConfirmationService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Tag } from 'primeng/tag';
import { distinctUntilChanged, map } from 'rxjs';
import { UsersStore } from '../../state/users.store';

@Component({
  selector: 'app-user-detail',
  imports: [Button, Tag],
  templateUrl: './user-detail.html',
  styleUrl: './user-detail.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserDetail {
  private readonly store = inject(UsersStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly confirmation = inject(ConfirmationService);

  readonly loading = toSignal(this.store.loading$, { initialValue: false });
  readonly user = toSignal(this.store.selectedUser$, { initialValue: null });

  constructor() {
    this.route.paramMap
      .pipe(
        map((params) => params.get('id')),
        distinctUntilChanged(),
        takeUntilDestroyed(),
      )
      .subscribe((id) => {
        if (id) {
          this.store.loadUser(id);
        }
      });
  }

  goToList(): void {
    void this.router.navigate(['/users']);
  }

  editUser(): void {
    const user = this.user();
    if (user) {
      void this.router.navigate(['/users', user.id, 'edit']);
    }
  }

  confirmDelete(): void {
    const user = this.user();
    if (!user) return;

    this.confirmation.confirm({
      header: 'Delete user',
      message: `Delete ${user.username}? This cannot be undone.`,
      acceptLabel: 'Delete',
      rejectLabel: 'Cancel',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.store.deleteUser(user.id).subscribe({
          next: () => void this.router.navigate(['/users']),
        });
      },
    });
  }
}
