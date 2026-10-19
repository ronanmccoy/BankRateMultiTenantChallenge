import type { SignalKey, TenantId } from './types';

/**
 * The engine calls these to get signals and rates. Each tenant has its own implementation, which may be a real service or a fake for testing.
 */

export interface ProfileClient {
  getSignals(
    input: { tenant: TenantId; userId: string; signals: readonly SignalKey[] },
    abort: AbortSignal,
  ): Promise<Partial<Record<SignalKey, number>>>;
}

export interface Rate {
  apr: number;
}

export interface PricingClient {
  getRates(
    input: { tenant: TenantId; offerIds: readonly string[] },
    abort: AbortSignal,
  ): Promise<Readonly<Record<string, Rate>>>;
}
