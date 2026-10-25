import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AdminService } from '../../../../core/services/admin.service';
import { ROLE_LABELS } from '../../models/user.model';
import { UsersStore } from '../../state/users.store';

@Component({
  selector: 'shin-user-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, RouterLink],
  providers: [UsersStore],
  templateUrl: './user-detail.component.html',
  styleUrl: '../users.css',
})
export class UserDetailComponent {
  readonly users = inject(UsersStore);
  readonly me = inject(AdminService).userId;
  readonly roles = ROLE_LABELS;
  constructor() {
    this.users.open(inject(ActivatedRoute).snapshot.paramMap.get('id') ?? '');
  }
}
