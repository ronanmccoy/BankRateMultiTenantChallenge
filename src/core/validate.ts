import { signalFor } from './rules';
import type { TenantConfig } from './types';

/** Each dependency call will leave headroom inside the 200ms p99 budget. */
export const MAX_DEPENDENCY_TIMEOUT_MS = 150;

/**
 * Semantic checks the type system can't express. Run at startup to validate instead of serving something wrong.
 */
export function validateTenantConfig(config: TenantConfig): string[] {
  const errors: string[] = [];
  const fail = (message: string) => errors.push(`[${config.id}] ${message}`);
  const seen = new Set<string>();

  for (const offer of config.offers) {
    if (seen.has(offer.id)) fail(`duplicate offer id "${offer.id}"`);
    seen.add(offer.id);

    if (!offer.visibleTo.includes(config.id)) {
      fail(`offer "${offer.id}" is not visible to its own tenant (visibleTo: ${offer.visibleTo.join(', ')})`);
    }
    if (offer.kind === 'exclusive' && offer.visibleTo.length !== 1) {
      fail(`exclusive offer "${offer.id}" must be visible to exactly one tenant`);
    }
    for (const rule of offer.rules) {
      const signal = signalFor(rule);
      if (!(signal in config.claimSignals) && !config.profileSignals.includes(signal)) {
        fail(`offer "${offer.id}" rule ${rule.type} needs signal "${signal}", which this tenant has no source for`);
      }
    }
  }

  if (config.fallbackOfferIds.length === 0) fail('fallbackOfferIds must not be empty');
  for (const id of config.fallbackOfferIds) {
    const offer = config.offers.find((candidate) => candidate.id === id);
    if (!offer) {
      fail(`fallback "${id}" is not in the tenant's offers`);
      continue;
    }
    if (offer.kind !== 'baseline') fail(`fallback "${id}" must be a baseline offer`);
    if (offer.requiresPricing || offer.rules.length > 0) {
      fail(`fallback "${id}" must not depend on pricing or rules (it is served when dependencies are down)`);
    }
  }

  for (const [name, ms] of Object.entries(config.timeouts)) {
    if (ms <= 0 || ms > MAX_DEPENDENCY_TIMEOUT_MS) {
      fail(`timeouts.${name} must be between 1 and ${MAX_DEPENDENCY_TIMEOUT_MS}ms`);
    }
  }

  return errors;
}

export function validateRegistry(configs: readonly TenantConfig[]): string[] {
  const errors = configs.flatMap(validateTenantConfig);

  const tenantIds = new Set<string>();
  for (const config of configs) {
    if (tenantIds.has(config.id)) errors.push(`duplicate tenant id "${config.id}"`);
    tenantIds.add(config.id);
  }

  // An offer ID lives in exactly one tenant's config, so a decision record's offer ID will always identify whose offer it was.
  const ownerByOfferId = new Map<string, string>();
  for (const config of configs) {
    for (const offer of config.offers) {
      const owner = ownerByOfferId.get(offer.id);
      if (owner && owner !== config.id) {
        errors.push(`offer id "${offer.id}" appears in both ${owner} and ${config.id}`);
      }
      ownerByOfferId.set(offer.id, config.id);
    }
  }

  return errors;
}
