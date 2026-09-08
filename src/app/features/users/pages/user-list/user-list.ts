import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ConfirmationService } from 'primeng/api';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import { combineLatest, debounceTime, map, startWith } from 'rxjs';
import { User } from '../../models/user.model';
import { UsersStore } from '../../state/users.store';

@Component({
  selector: 'app-user-list',
  imports: [ReactiveFormsModule, TableModule, Button, InputText, Tag],
  templateUrl: './user-list.html',
  styleUrl: './user-list.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserList implements OnInit {
  private readonly store = inject(UsersStore);
  private readonly router = inject(Router);
  private readonly confirmation = inject(ConfirmationService);

  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly loading = toSignal(this.store.loading$, { initialValue: false });
  readonly users = toSignal(
    combineLatest([
      this.store.users$,
      this.searchControl.valueChanges.pipe(startWith(this.searchControl.value), debounceTime(150)),
    ]).pipe(
      map(([users, query]) => {
        const term = query.trim().toLowerCase();
        if (!term) return users;

        return users.filter((user) =>
          [user.username, user.email, user.firstName, user.lastName, user.role]
            .join(' ')
            .toLowerCase()
            .includes(term),
        );
      }),
    ),
    { initialValue: [] as User[] },
  );

  ngOnInit(): void {
    this.store.loadUsers();
  }

  createUser(): void {
    void this.router.navigate(['/users/new']);
  }

  viewUser(user: User): void {
    void this.router.navigate(['/users', user.id]);
  }

  editUser(user: User): void {
    void this.router.navigate(['/users', user.id, 'edit']);
  }

  confirmDelete(user: User): void {
    this.confirmation.confirm({
      header: 'Delete user',
      message: `Delete ${user.username}? This cannot be undone.`,
      acceptLabel: 'Delete',
      rejectLabel: 'Cancel',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.store.deleteUser(user.id).subscribe();
      },
    });
  }
}
