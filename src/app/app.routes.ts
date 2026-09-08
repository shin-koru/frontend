import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'users' },
  {
    path: 'users',
    loadChildren: () => import('./features/users/users.routes').then((m) => m.usersRoutes),
  },
];
