import { Plan } from './subscription.model';
export type PlanDraft = Omit<Plan, 'id'>;
export interface PromoDraft {
  planId: string;
  maxRedemptions: number;
  expiresAt: string;
}
export interface PromoSummary extends PromoDraft {
  id: string;
  redemptionCount: number;
  isActive: boolean;
  createdAt: string;
}
export interface CreatedPromo extends PromoDraft {
  id: string;
  code: string;
}
export interface Page<T> {
  items: T[];
  total: number;
}
