import { Routes } from '@angular/router';
import { UserDetailComponent } from './pages/user-detail/user-detail.component';
import { UserListComponent } from './pages/user-list/user-list.component';

export const usersRoutes: Routes = [
  { path: '', component: UserListComponent, title: 'Users — SHIN' },
  { path: ':id', component: UserDetailComponent, title: 'User — SHIN' },
];
