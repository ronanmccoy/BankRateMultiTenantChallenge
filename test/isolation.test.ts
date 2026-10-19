import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { FakeMode } from '../src/adapters/fakes';
import { personalize } from '../src/core/engine';
import { createRegistry } from '../src/core/registry';
import { SURFACES, type TenantConfig } from '../src/core/types';
import { tenantRegistry } from '../src/tenants';
import { switchback } from '../src/tenants/switchback';
import { tenant0 } from '../src/tenants/tenant0';
import { switchbackUser, testDeps } from './helpers';

/**
 * CI gate for tenant isolation. It iterates the real tenant registry, so a
 * newly added tenant is covered automatically with no test changes.
 */
const tenants = tenantRegistry.all();
const exclusiveIdsOf = (config: TenantConfig) =>
  config.offers.filter((offer) => offer.kind === 'exclusive').map((offer) => offer.id);

// Every claim any tenant reads, so each tenant is also tested against other
// tenants' claims (e.g. a tenant 0 request carrying Switchback-shaped claims).
const allClaimNames = [...new Set(tenants.flatMap((tenant) => Object.values(tenant.claimSignals)))];
const claimsArbitrary = fc.record(
  Object.fromEntries(allClaimNames.map((name) => [name, fc.integer({ min: 0, max: 100_000 })])),
  { requiredKeys: [] },
);
const dependencyMode = fc.constantFrom<FakeMode>('ok', 'error');

describe('tenant isolation', () => {
  it('has at least two tenants, each with an exclusive offer (so the checks below are meaningful)', () => {
    expect(tenants.length).toBeGreaterThanOrEqual(2);
    for (const tenant of tenants) expect(exclusiveIdsOf(tenant).length).toBeGreaterThan(0);
  });

  describe.each(tenants.map((tenant) => [tenant.id, tenant] as const))('%s', (tenantId, config) => {
    const foreignExclusiveIds = new Set(tenants.filter((t) => t.id !== tenantId).flatMap(exclusiveIdsOf));
    const ownOfferIds = new Set(config.offers.map((offer) => offer.id));

    it("never returns another tenant's exclusive offers, for any claims, surface or dependency state", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            surface: fc.constantFrom(...SURFACES),
            claims: claimsArbitrary,
            memberDays: fc.integer({ min: 0, max: 5_000 }),
            profile: dependencyMode,
            pricing: dependencyMode,
          }),
          async (input) => {
            const result = await personalize(
              { tenant: tenantId, surface: input.surface, user: { id: 'user-1', claims: input.claims } },
              config,
              testDeps(input),
            );
            for (const offer of result.response.offers) {
              expect(foreignExclusiveIds.has(offer.id), `${offer.id} leaked into ${tenantId}`).toBe(false);
              expect(ownOfferIds.has(offer.id), `${offer.id} is not ${tenantId}'s offer`).toBe(true);
            }
            expect(result.violations).toEqual([]);
          },
        ),
        { numRuns: 300 },
      );
    });

    it('can still show its own exclusive offers (proves the check above is not passing vacuously)', async () => {
      // Every rule today is a minimum threshold, so maxed-out signals qualify for everything.
      const maxedClaims = Object.fromEntries(allClaimNames.map((name) => [name, 100_000]));
      const result = await personalize(
        { tenant: tenantId, surface: 'offers', user: { id: 'user-1', claims: maxedClaims } },
        config,
        testDeps({ memberDays: 5_000 }),
      );
      const shown = result.response.offers.map((offer) => offer.id);
      for (const id of exclusiveIdsOf(config)) expect(shown).toContain(id);
    });
  });
});

describe('egress guard', () => {
  it("blocks every offer when the engine is handed the wrong tenant's config", async () => {
    // Simulates a config-resolution or cache-key bug: a tenant 0 request evaluated against Switchback's config.
    const result = await personalize(
      { tenant: 'tenant0', surface: 'offers', user: switchbackUser() },
      switchback,
      testDeps(),
    );
    expect(result.response.offers).toEqual([]);
    expect(result.violations.map((v) => v.offerId)).toContain('sb-partner-rate');
    expect(result.decision.degradedReasons).toContain('isolation_violation');
    const partnerRate = result.decision.offers.find((offer) => offer.offerId === 'sb-partner-rate');
    expect(partnerRate?.reasons).toContain('blocked by egress guard: not visible to request tenant');
  });
});

describe('startup config validation', () => {
  const partnerRate = switchback.offers.find((offer) => offer.id === 'sb-partner-rate')!;

  it("rejects a Switchback exclusive copied into tenant 0's offers", () => {
    const leaky = { ...tenant0, offers: [...tenant0.offers, partnerRate] };
    expect(() => createRegistry([leaky, switchback])).toThrow(/not visible to its own tenant/);
  });

  it('rejects an exclusive offer made visible to more than one tenant', () => {
    const shared = {
      ...switchback,
      offers: switchback.offers.map((offer) =>
        offer.id === 'sb-partner-rate' ? { ...offer, visibleTo: ['switchback', 'tenant0'] } : offer,
      ),
    };
    expect(() => createRegistry([tenant0, shared])).toThrow(/exactly one tenant/);
  });

  it('rejects a fallback that depends on pricing', () => {
    const badFallback = { ...switchback, fallbackOfferIds: ['sb-hysa'] };
    expect(() => createRegistry([tenant0, badFallback])).toThrow(/must not depend on pricing or rules/);
  });

  it('rejects a rule whose signal the tenant has no source for', () => {
    const missingSignal = {
      ...tenant0,
      offers: tenant0.offers.map((offer) =>
        offer.id === 't0-hysa' ? { ...offer, rules: [{ type: 'minTenureMonths' as const, months: 6 }] } : offer,
      ),
    };
    expect(() => createRegistry([missingSignal, switchback])).toThrow(/no source for/);
  });
});
