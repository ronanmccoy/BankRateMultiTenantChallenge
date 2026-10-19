import type { TenantConfig, TenantId } from './types';
import { validateRegistry } from './validate';

/**
 * A registry of all tenant configs, keyed by tenant ID. The engine uses this to resolve a request's tenant ID to its config.
 * The registry is built once at service startup and never changes. It validates every config up front and refuses to start if any are invalid.
 */

export interface TenantRegistry {
  get(id: TenantId): TenantConfig | undefined;
  all(): readonly TenantConfig[];
}

/** Validates every tenant config up front and refuses to build if any are invalid. */
export function createRegistry(configs: readonly TenantConfig[]): TenantRegistry {
  const errors = validateRegistry(configs);
  if (errors.length > 0) {
    throw new Error(`Invalid tenant configuration:\n  - ${errors.join('\n  - ')}`);
  }
  const byId = new Map(configs.map((config) => [config.id, config]));
  return {
    get: (id) => byId.get(id),
    all: () => configs,
  };
}
