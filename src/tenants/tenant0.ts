import type { TenantConfig } from '../core/types';

/** Our own logged-in members. Signals come from our profile service, not the token. */
export const tenant0: TenantConfig = {
  id: 'tenant0',
  version: '2026-10-19.1',
  claimSignals: {},
  profileSignals: ['memberDays'],
  sensitiveSignals: [],
  offers: [
    {
      id: 't0-hysa',
      title: 'High-yield savings account',
      kind: 'baseline',
      visibleTo: ['tenant0'],
      surfaces: ['offers', 'dashboard'],
      requiresPricing: true,
      rules: [],
    },
    {
      id: 't0-member-rewards-card',
      title: 'Member rewards credit card',
      kind: 'exclusive',
      visibleTo: ['tenant0'],
      surfaces: ['offers', 'dashboard'],
      requiresPricing: false,
      rules: [{ type: 'minMemberDays', days: 365 }],
    },
    {
      id: 't0-budgeting-guide',
      title: 'Budgeting basics guide',
      kind: 'baseline',
      visibleTo: ['tenant0'],
      surfaces: ['dashboard'],
      requiresPricing: false,
      rules: [],
    },
  ],
  fallbackOfferIds: ['t0-budgeting-guide'],
  timeouts: { profileMs: 60, pricingMs: 80 },
};
