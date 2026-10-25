import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/services/admin.service';

export const routes: Routes = [
  { path: 'login', redirectTo: 'auth/login', pathMatch: 'full' },
  {
    path: 'admin/users',
    loadChildren: () => import('./features/users/users.routes').then((m) => m.usersRoutes),
    canActivate: [authGuard, adminGuard],
  },
  { path: 'users', redirectTo: 'admin/users', pathMatch: 'full' },
  {
    path: 'auth',
    loadChildren: () => import('./features/auth/auth.routes').then((m) => m.authRoutes),
  },
  {
    path: 'profile',
    loadChildren: () => import('./features/profile/profile.routes').then((m) => m.profileRoutes),
    canActivate: [authGuard],
  },
  {
    path: '',
    loadChildren: () => import('./features/movies/movies.routes').then((m) => m.movieRoutes),
  },
  {
    path: '',
    loadChildren: () =>
      import('./features/subscriptions/subscriptions.routes').then((m) => m.subscriptionRoutes),
  },
  { path: '**', redirectTo: '' },
];
