import { Routes } from '@angular/router';
import { UserDetail } from './pages/user-detail/user-detail';
import { UserForm } from './pages/user-form/user-form';
import { UserList } from './pages/user-list/user-list';

export const usersRoutes: Routes = [
  { path: '', component: UserList },
  { path: 'new', component: UserForm },
  { path: ':id', component: UserDetail },
  { path: ':id/edit', component: UserForm },
];
