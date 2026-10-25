import { Routes } from '@angular/router';
import { authGuard } from '../../core/guards/auth.guard';
import { adminGuard } from '../../core/services/admin.service';

export const movieRoutes: Routes = [
  {
    path: 'watch-history',
    canActivate: [authGuard],
    title: 'Watch history — SHIN',
    loadComponent: () => import('./pages/history.component').then((m) => m.HistoryComponent),
  },
  {
    path: 'admin/media',
    canActivate: [authGuard, adminGuard],
    title: 'Admin Studio — SHIN',
    canDeactivate: [(component: { canLeave(): boolean }) => component.canLeave()],
    loadComponent: () => import('./pages/admin-media.component').then((m) => m.AdminMediaComponent),
  },
  {
    path: '',
    pathMatch: 'full',
    title: 'SHIN — Stories worth staying in for',
    loadComponent: () => import('./pages/home.component').then((m) => m.HomeComponent),
  },
  {
    path: 'movies',
    canActivate: [authGuard],
    title: 'Movies — SHIN',
    loadComponent: () => import('./pages/catalog.component').then((m) => m.CatalogComponent),
  },
  {
    path: 'movies/:slug',
    canActivate: [authGuard],
    title: 'Movie details — SHIN',
    loadComponent: () => import('./pages/details.component').then((m) => m.DetailsComponent),
  },
];
