import { Routes } from '@angular/router';
import { ProfileCreateComponent } from './pages/profile-create/profile-create.component';

export const profileRoutes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'Your profile — SHIN',
    loadComponent: () => import('./pages/profile.component').then((m) => m.ProfileComponent),
  },
  { path: 'create', component: ProfileCreateComponent },
];
