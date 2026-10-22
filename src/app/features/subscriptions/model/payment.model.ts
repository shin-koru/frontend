export interface PaymentOptions {
  enabled: boolean;
  mode: 'demo' | 'freedompay_test' | 'disabled';
  currency: string;
}
export interface PaymentOrder {
  provider?: string;
  userId?: string;
  id: string;
  planId: string;
  planName: string;
  amount: number;
  currency: string;
  status: 'CREATING' | 'PENDING' | 'PAID' | 'FAILED' | 'EXPIRED' | 'REVIEW' | 'CONFIRMED';
  mode: 'demo' | 'freedompay_test';
  checkoutUrl: string;
  subscriptionId: string;
  expiresAt: string;
  createdAt: string;
}
export function trustedCheckoutUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' &&
      ['api.freedompay.kz', 'customer.freedompay.kz'].includes(url.hostname) &&
      !url.port &&
      !url.username &&
      !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}

export interface PaymentPage {
  items: PaymentOrder[];
  total: number;
}
