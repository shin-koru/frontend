import { Routes } from '@angular/router';
import { authGuard } from '../../core/guards/auth.guard';
import { adminGuard } from '../../core/services/admin.service';

export const subscriptionRoutes: Routes = [
  {
    path: 'admin/subscriptions',
    canActivate: [authGuard, adminGuard],
    title: 'Subscription administration - SHIN',
    loadComponent: () =>
      import('./pages/admin/subscription-admin.component').then(
        (m) => m.SubscriptionAdminComponent,
      ),
  },
  {
    path: 'plans',
    canActivate: [authGuard],
    title: 'Plans and subscription - SHIN',
    loadComponent: () => import('./pages/plans/plans.component').then((m) => m.PlansComponent),
  },
];
