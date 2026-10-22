import { Routes } from '@angular/router';
import { authGuard } from '../../core/guards/auth.guard';
import { adminGuard } from '../../core/services/admin.service';

export const subscriptionRoutes: Routes = [
  {
    path: 'payments',
    canActivate: [authGuard],
    title: 'Payment history - SHIN',
    loadComponent: () =>
      import('./pages/payment-history/payment-history.component').then(
        (m) => m.PaymentHistoryComponent,
      ),
  },
  {
    path: 'admin/payments',
    canActivate: [authGuard, adminGuard],
    data: { admin: true },
    title: 'Payments administration - SHIN',
    loadComponent: () =>
      import('./pages/payment-history/payment-history.component').then(
        (m) => m.PaymentHistoryComponent,
      ),
  },
  {
    path: 'plans/payment/:id',
    canActivate: [authGuard],
    title: 'Test checkout - SHIN',
    loadComponent: () =>
      import('./pages/payment/payment.component').then((m) => m.PaymentComponent),
  },
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
