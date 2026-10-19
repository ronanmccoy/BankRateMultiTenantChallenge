import { describe, expect, it } from 'vitest';
import { personalize } from '../src/core/engine';
import { switchback } from '../src/tenants/switchback';
import { tenant0 } from '../src/tenants/tenant0';
import { offerIds, switchbackUser, tenant0Member, testDeps } from './helpers';

describe('degraded mode', () => {
  it('pricing down: never shows a priced or exclusive rate, serves the tenant fallback', async () => {
    const result = await personalize(
      { tenant: 'switchback', surface: 'offers', user: switchbackUser() },
      switchback,
      testDeps({ pricing: 'error' }),
    );
    expect(offerIds(result)).toEqual(['sb-gig-tax-guide']);
    expect(result.response.degraded).toBe(true);
    expect(result.decision.fallbackUsed).toBe(true);
    expect(result.decision.degradedReasons).toEqual(['pricing:error']);
  });

  it('pricing down: tenant 0 still shows eligible offers that do not need a price', async () => {
    const result = await personalize(
      { tenant: 'tenant0', surface: 'offers', user: tenant0Member },
      tenant0,
      testDeps({ pricing: 'error' }),
    );
    expect(offerIds(result)).toEqual(['t0-member-rewards-card']);
    expect(result.decision.fallbackUsed).toBe(false);
    const savings = result.decision.offers.find((offer) => offer.offerId === 't0-hysa');
    expect(savings).toMatchObject({ shown: false, reasons: ['pricing: error'] });
  });

  it('pricing slow: times out inside the latency budget and degrades the same way', async () => {
    const startedAt = performance.now();
    const result = await personalize(
      { tenant: 'switchback', surface: 'offers', user: switchbackUser() },
      switchback,
      testDeps({ pricing: 'slow' }),
    );
    expect(performance.now() - startedAt).toBeLessThan(200);
    expect(result.decision.dependencies.pricing.status).toBe('timeout');
    expect(offerIds(result)).toEqual(['sb-gig-tax-guide']);
  });

  it('profile down: tenant 0 loses only the offers that need profile data', async () => {
    const result = await personalize(
      { tenant: 'tenant0', surface: 'offers', user: tenant0Member },
      tenant0,
      testDeps({ profile: 'error' }),
    );
    expect(offerIds(result)).toEqual(['t0-hysa']);
    expect(result.response.degraded).toBe(true);
    expect(result.decision.fallbackUsed).toBe(false);
    const rewardsCard = result.decision.offers.find((offer) => offer.offerId === 't0-member-rewards-card');
    expect(rewardsCard?.reasons).toEqual(['memberDays >= 365: signal unavailable']);
  });

  it('Switchback never calls the profile service, so a profile outage does not degrade it', async () => {
    const result = await personalize(
      { tenant: 'switchback', surface: 'offers', user: switchbackUser() },
      switchback,
      testDeps({ profile: 'error' }),
    );
    expect(result.decision.dependencies.profile.status).toBe('skipped');
    expect(result.response.degraded).toBe(false);
    expect(offerIds(result)).toEqual(['sb-hysa', 'sb-partner-rate']);
  });

  it('everything down: tenant 0 still gets its fallback', async () => {
    const result = await personalize(
      { tenant: 'tenant0', surface: 'offers', user: tenant0Member },
      tenant0,
      testDeps({ profile: 'error', pricing: 'error' }),
    );
    expect(offerIds(result)).toEqual(['t0-budgeting-guide']);
    expect(result.decision.degradedReasons).toEqual(['profile:error', 'pricing:error']);
  });
});
