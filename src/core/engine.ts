import { randomUUID } from 'node:crypto';
import type { DecisionRecord, OfferDecision } from './decision';
import { enforceTenantBoundary, type IsolationViolation } from './egress-guard';
import type { PricingClient, ProfileClient, Rate } from './ports';
import { evaluateRule, signalFor } from './rules';
import { signalsFromClaims, toSignalValue, type Signals } from './signals';
import { callWithTimeout, skipped, type DependencyResult } from './timeout';
import type {
  OfferConfig,
  PersonalizeRequest,
  PersonalizeResponse,
  SignalKey,
  TenantConfig,
} from './types';

export interface EngineDeps {
  profile: ProfileClient;
  pricing: PricingClient;
  newId?: () => string;
  now?: () => Date;
}

export interface PersonalizeResult {
  response: PersonalizeResponse;
  decision: DecisionRecord;
  violations: IsolationViolation[];
}

interface EvaluatedOffer {
  offer: OfferConfig;
  eligible: boolean;
  reasons: string[];
  rate?: Rate;
}

/**
 * The single path for every tenant. The engine is shared, the rules are shared, the signals are shared.
 * The only per-tenant data is the config.
 */
export async function personalize(
  request: PersonalizeRequest,
  config: TenantConfig,
  deps: EngineDeps,
): Promise<PersonalizeResult> {
  const signals = signalsFromClaims(config, request.user.claims);
  const candidates = config.offers.filter((offer) => offer.surfaces.includes(request.surface));

  const neededProfileSignals = profileSignalsNeeded(config, candidates, signals);
  const pricedOfferIds = candidates.filter((offer) => offer.requiresPricing).map((offer) => offer.id);

  const [profile, pricing] = await Promise.all([
    neededProfileSignals.length === 0
      ? skipped<Partial<Record<SignalKey, number>>>()
      : callWithTimeout(
          (abort) =>
            deps.profile.getSignals(
              { tenant: config.id, userId: request.user.id, signals: neededProfileSignals },
              abort,
            ),
          config.timeouts.profileMs,
        ),
    pricedOfferIds.length === 0
      ? skipped<Readonly<Record<string, Rate>>>()
      : callWithTimeout(
          (abort) => deps.pricing.getRates({ tenant: config.id, offerIds: pricedOfferIds }, abort),
          config.timeouts.pricingMs,
        ),
  ]);

  if (profile.status === 'ok') {
    for (const key of neededProfileSignals) {
      const value = profile.value[key];
      if (typeof value === 'number') signals[key] = toSignalValue(config, key, value);
    }
  }

  const evaluated = candidates.map((offer) => evaluateOffer(offer, signals, pricing));
  let selected = evaluated.filter((item) => item.eligible);

  const fallbackUsed = selected.length === 0;
  if (fallbackUsed) selected = fallbackOffers(config);

  const { allowed, violations } = enforceTenantBoundary(
    request.tenant,
    selected.map((item) => item.offer),
  );
  const shownIds = new Set(allowed.map((offer) => offer.id));
  const shown = selected.filter((item) => shownIds.has(item.offer.id));

  const degradedReasons = [
    ...dependencyFailures({ profile, pricing }),
    ...(violations.length > 0 ? ['isolation_violation'] : []),
  ];

  const decisionId = (deps.newId ?? randomUUID)();
  const decision: DecisionRecord = {
    decisionId,
    timestamp: (deps.now?.() ?? new Date()).toISOString(),
    tenant: request.tenant,
    surface: request.surface,
    userId: request.user.id,
    configVersion: config.version,
    degraded: degradedReasons.length > 0,
    degradedReasons,
    fallbackUsed,
    dependencies: {
      profile: { status: profile.status, latencyMs: profile.latencyMs },
      pricing: { status: pricing.status, latencyMs: pricing.latencyMs },
    },
    offers: offerDecisions(
      fallbackUsed ? [...evaluated, ...selected] : evaluated,
      shownIds,
      new Set(violations.map((violation) => violation.offerId)),
    ),
  };

  const response: PersonalizeResponse = {
    decisionId,
    tenant: request.tenant,
    surface: request.surface,
    degraded: decision.degraded,
    offers: shown.map(({ offer, rate }) => ({
      id: offer.id,
      title: offer.title,
      kind: offer.kind,
      ...(rate ? { rate: { apr: rate.apr } } : {}),
    })),
  };

  return { response, decision, violations };
}

function profileSignalsNeeded(
  config: TenantConfig,
  candidates: readonly OfferConfig[],
  signals: Signals,
): SignalKey[] {
  const needed = new Set(candidates.flatMap((offer) => offer.rules.map(signalFor)));
  return [...needed].filter((key) => signals[key] === undefined && config.profileSignals.includes(key));
}

function evaluateOffer(
  offer: OfferConfig,
  signals: Signals,
  pricing: DependencyResult<Readonly<Record<string, Rate>>>,
): EvaluatedOffer {
  const outcomes = offer.rules.map((rule) => evaluateRule(rule, signals));
  const reasons = outcomes.map((outcome) => outcome.reason);
  const rulesPass = outcomes.every((outcome) => outcome.pass);

  if (!offer.requiresPricing) return { offer, eligible: rulesPass, reasons };

  // A priced offer is only shown with a rate the pricing service actually returned.
  const rate = pricing.status === 'ok' ? pricing.value[offer.id] : undefined;
  if (rate === undefined) {
    reasons.push(pricing.status === 'ok' ? 'pricing: no rate returned' : `pricing: ${pricing.status}`);
    return { offer, eligible: false, reasons };
  }
  return { offer, eligible: rulesPass, reasons, rate };
}

function fallbackOffers(config: TenantConfig): EvaluatedOffer[] {
  return config.fallbackOfferIds
    .map((id) => config.offers.find((offer) => offer.id === id))
    .filter((offer): offer is OfferConfig => offer !== undefined)
    .map((offer) => ({ offer, eligible: true, reasons: ['fallback: no other offer was eligible'] }));
}

function dependencyFailures(results: Record<string, DependencyResult<unknown>>): string[] {
  return Object.entries(results)
    .filter(([, result]) => result.status === 'timeout' || result.status === 'error')
    .map(([name, result]) => `${name}:${result.status}`);
}

function offerDecisions(
  items: readonly EvaluatedOffer[],
  shownIds: ReadonlySet<string>,
  blockedIds: ReadonlySet<string>,
): OfferDecision[] {
  const byId = new Map<string, OfferDecision>();
  for (const { offer, reasons } of items) {
    byId.set(offer.id, {
      offerId: offer.id,
      kind: offer.kind,
      shown: shownIds.has(offer.id),
      reasons: blockedIds.has(offer.id)
        ? [...reasons, 'blocked by egress guard: not visible to request tenant']
        : reasons,
    });
  }
  return [...byId.values()];
}
