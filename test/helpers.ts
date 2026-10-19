import { createFakePricingClient, createFakeProfileClient, type FakeMode } from '../src/adapters/fakes';
import type { EngineDeps, PersonalizeResult } from '../src/core/engine';

export function testDeps(options: { profile?: FakeMode; pricing?: FakeMode; memberDays?: number } = {}): EngineDeps {
  return {
    profile: createFakeProfileClient({ mode: options.profile, defaultMemberDays: options.memberDays }),
    pricing: createFakePricingClient({ mode: options.pricing }),
    newId: () => 'decision-test',
    now: () => new Date('2026-10-19T00:00:00.000Z'),
  };
}

export function switchbackUser(signals: { tenureMonths?: number; earningsUsd?: number } = {}) {
  return {
    id: 'sb-user-1',
    claims: {
      sb_tenure_months: signals.tenureMonths ?? 12,
      sb_monthly_earnings_usd: signals.earningsUsd ?? 3_500,
      email: 'worker@example.com', // not mapped in config, so never read
    },
  };
}

export const tenant0Member = { id: 'member-1', claims: {} };

export const offerIds = (result: PersonalizeResult) => result.response.offers.map((offer) => offer.id);

/**
 * Deep-scans any value for the given numbers, returning the paths where they
 * appear. Used to prove sensitive values never reach responses, records or logs.
 */
export function findValues(value: unknown, needles: readonly number[]): string[] {
  const hits: string[] = [];
  const walk = (current: unknown, path: string) => {
    if (typeof current === 'number' && needles.includes(current)) {
      hits.push(path);
    } else if (typeof current === 'string' && needles.some((n) => new RegExp(`\\b${n}\\b`).test(current))) {
      hits.push(path);
    } else if (current !== null && typeof current === 'object') {
      for (const [key, child] of Object.entries(current)) walk(child, `${path}.${key}`);
    }
  };
  walk(value, '$');
  return hits;
}
