import type { Rule } from './rules';

/**
 * Tenant IDs are data, not a union type: adding a tenant must never require a change to the shared engine.
 */
export type TenantId = string;

export type Surface = 'offers' | 'dashboard';
export const SURFACES: readonly Surface[] = ['offers', 'dashboard'];

/**
 * The engine's vocabulary of signals. Adding a signal is an engine change not a per-tenant change.
 */
export type SignalKey = 'tenureMonths' | 'monthlyEarningsUsd' | 'memberDays';

export interface OfferConfig {
  id: string;
  title: string;
  kind: 'baseline' | 'exclusive';
  visibleTo: readonly TenantId[];
  surfaces: readonly Surface[];
  requiresPricing: boolean;
  rules: readonly Rule[];
}

export interface TenantConfig {
  id: TenantId;
  version: string;
  claimSignals: Readonly<Partial<Record<SignalKey, string>>>;
  profileSignals: readonly SignalKey[];
  sensitiveSignals: readonly SignalKey[];
  offers: readonly OfferConfig[];
  fallbackOfferIds: readonly string[];
  timeouts: { profileMs: number; pricingMs: number };
}

export interface PersonalizeRequest {
  tenant: TenantId;
  surface: Surface;
  user: { id: string; claims: Readonly<Record<string, unknown>> };
}

export interface RenderedOffer {
  id: string;
  title: string;
  kind: OfferConfig['kind'];
  rate?: { apr: number };
}

export interface PersonalizeResponse {
  decisionId: string;
  tenant: TenantId;
  surface: Surface;
  degraded: boolean;
  offers: RenderedOffer[];
}
