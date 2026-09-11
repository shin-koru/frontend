import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { App } from './app';

export const routes: Routes = [
  { 
    path: '', 
    pathMatch: 'full', 
    component: App, 
    canActivate: [authGuard] 
  },
  {
    path: 'users',
    loadChildren: () => import('./features/users/users.routes').then((m) => m.usersRoutes),
    canActivate: [authGuard], // Guard protected routes like users instead
  },
  {
    path: 'auth',
    loadChildren: () => import('./features/auth/auth.routes').then((m) => m.authRoutes),
  },
  {
    path: 'profile',
    loadChildren: () => import('./features/profile/profile.routes').then((m) => m.profileRoutes),
    canActivate: [authGuard],
  },
];
