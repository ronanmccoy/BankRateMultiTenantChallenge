import { Redacted } from './redacted';
import type { SignalKey, TenantConfig } from './types';

export type SignalValue = number | Redacted<number>;
export type Signals = Partial<Record<SignalKey, SignalValue>>;

/**
 * Applies the tenant's sensitivity policy the moment a value enters the engine. The engine never sees the raw value.
*/
export function toSignalValue(config: TenantConfig, key: SignalKey, value: number): SignalValue {
  return config.sensitiveSignals.includes(key) ? new Redacted(value) : value;
}

export function readSignal(value: SignalValue): number {
  return value instanceof Redacted ? value.reveal() : value;
}

/**
 * Converts SSO claims to engine signals based on the tenant's configuration. Only claims mapped in the tenant's config are read; 
 * everything else in the token is ignored.
 */
export function signalsFromClaims(config: TenantConfig, claims: Readonly<Record<string, unknown>>): Signals {
  const signals: Signals = {};
  for (const [key, claimName] of Object.entries(config.claimSignals) as [SignalKey, string][]) {
    const raw = claims[claimName];
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      signals[key] = toSignalValue(config, key, raw);
    }
  }
  return signals;
}
