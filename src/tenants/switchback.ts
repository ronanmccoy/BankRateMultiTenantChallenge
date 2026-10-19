import type { TenantConfig } from '../core/types';

/** Embedded partner. Users arrive via SSO; signals come from the verified token. */
export const switchback: TenantConfig = {
  id: 'switchback',
  version: '2026-10-19.1',
  claimSignals: {
    tenureMonths: 'sb_tenure_months',
    monthlyEarningsUsd: 'sb_monthly_earnings_usd',
  },
  profileSignals: [],
  sensitiveSignals: ['tenureMonths', 'monthlyEarningsUsd'],
  offers: [
    {
      id: 'sb-hysa',
      title: 'High-yield savings account',
      kind: 'baseline',
      visibleTo: ['switchback'],
      surfaces: ['offers', 'dashboard'],
      requiresPricing: true,
      rules: [],
    },
    {
      id: 'sb-partner-rate',
      title: 'Switchback Partner Rate savings',
      kind: 'exclusive',
      visibleTo: ['switchback'],
      surfaces: ['offers', 'dashboard'],
      requiresPricing: true,
      rules: [
        { type: 'minTenureMonths', months: 6 },
        { type: 'minMonthlyEarningsUsd', usd: 2000 },
      ],
    },
    {
      id: 'sb-gig-tax-guide',
      title: 'Gig-income tax guide',
      kind: 'baseline',
      visibleTo: ['switchback'],
      surfaces: ['dashboard'],
      requiresPricing: false,
      rules: [],
    },
  ],
  fallbackOfferIds: ['sb-gig-tax-guide'],
  timeouts: { profileMs: 60, pricingMs: 80 },
};
