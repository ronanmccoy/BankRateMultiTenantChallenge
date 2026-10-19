import type { OfferConfig, TenantId } from './types';

export interface IsolationViolation {
  offerId: string;
  requestTenant: TenantId;
  visibleTo: readonly TenantId[];
}

/**
 * Enforces the tenant isolation rule: a tenant can only see offers that list it in `visibleTo`.
 */
export function enforceTenantBoundary<T extends Pick<OfferConfig, 'id' | 'visibleTo'>>(
  requestTenant: TenantId,
  offers: readonly T[],
): { allowed: T[]; violations: IsolationViolation[] } {
  const allowed: T[] = [];
  const violations: IsolationViolation[] = [];
  for (const offer of offers) {
    if (offer.visibleTo.includes(requestTenant)) {
      allowed.push(offer);
    } else {
      violations.push({ offerId: offer.id, requestTenant, visibleTo: offer.visibleTo });
    }
  }
  return { allowed, violations };
}
