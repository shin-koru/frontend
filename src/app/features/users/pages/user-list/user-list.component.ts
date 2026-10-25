import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminService } from '../../../../core/services/admin.service';
import { ROLE_LABELS, UserRole } from '../../models/user.model';
import { PAGE_SIZE, UsersStore } from '../../state/users.store';

@Component({
  selector: 'shin-user-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, RouterLink],
  providers: [UsersStore],
  templateUrl: './user-list.component.html',
  styleUrl: '../users.css',
})
export class UserListComponent {
  readonly users = inject(UsersStore);
  readonly me = inject(AdminService).userId;
  readonly roles = ROLE_LABELS;
  readonly pageSize = PAGE_SIZE;
  constructor() {
    this.users.load(0);
  }
  search(search: string, role: string, blocked: string) {
    this.users.applyFilter({
      search,
      role: role as UserRole | '',
      blocked: blocked as 'true' | 'false' | '',
    });
  }
  page() {
    return Math.floor(this.users.offset() / PAGE_SIZE) + 1;
  }
  pages() {
    return Math.max(1, Math.ceil(this.users.total() / PAGE_SIZE));
  }
}
