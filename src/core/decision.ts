import type { DependencyResult } from './timeout';
import type { OfferConfig, Surface, TenantId } from './types';

export interface OfferDecision {
  offerId: string;
  kind: OfferConfig['kind'];
  shown: boolean;
  reasons: string[];
}

/**
 * One record per request. Contains rule outcomes, never raw sensitive values.
 */
export interface DecisionRecord {
  decisionId: string;
  timestamp: string;
  tenant: TenantId;
  surface: Surface;
  userId: string;
  configVersion: string;
  degraded: boolean;
  degradedReasons: string[];
  fallbackUsed: boolean;
  dependencies: {
    profile: Pick<DependencyResult<unknown>, 'status' | 'latencyMs'>;
    pricing: Pick<DependencyResult<unknown>, 'status' | 'latencyMs'>;
  };
  offers: OfferDecision[];
}
