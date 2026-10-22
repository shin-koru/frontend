export interface Plan {
  id: string;
  name: string;
  price: number;
  currency: string;
  duration: number;
  maxDevices: number;
  maxQuality: string;
  isActive: boolean;
}
export interface UserSubscription {
  id: string;
  planId: string;
  status: 'ACTIVE' | 'CANCELED' | 'EXPIRED';
  startedAt: string;
  expiresAt: string;
  activationMethod: string;
}
export interface CurrentSubscription {
  subscription: UserSubscription | null;
  plan: Plan | null;
}

export function formatPlanPrice(plan: Plan): string {
  const formatter = new Intl.NumberFormat('en', { style: 'currency', currency: plan.currency });
  const digits = formatter.resolvedOptions().maximumFractionDigits ?? 2;
  return formatter.format(plan.price / 10 ** digits);
}
