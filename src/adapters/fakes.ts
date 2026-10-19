import { setTimeout as sleep } from 'node:timers/promises';
import type { PricingClient, ProfileClient } from '../core/ports';
import type { SignalKey } from '../core/types';

/**
 * In-memory stand-ins for the profile and pricing services, with injectable
 * failure modes so degraded behavior can be tested and demoed.
 */
export type FakeMode = 'ok' | 'error' | 'slow';

export interface FakeBehavior {
  mode?: FakeMode;
  latencyMs?: number;
  slowMs?: number;
}

async function simulate(behavior: FakeBehavior, abort: AbortSignal): Promise<void> {
  const mode = behavior.mode ?? 'ok';
  const delay = mode === 'slow' ? (behavior.slowMs ?? 1_000) : (behavior.latencyMs ?? 0);
  await sleep(delay, undefined, { signal: abort });
  if (mode === 'error') throw new Error('fake dependency failure');
}

export function createFakeProfileClient(
  options: FakeBehavior & { memberDaysByUser?: Record<string, number>; defaultMemberDays?: number } = {},
): ProfileClient {
  return {
    async getSignals({ userId, signals }, abort) {
      await simulate(options, abort);
      const result: Partial<Record<SignalKey, number>> = {};
      if (signals.includes('memberDays')) {
        result.memberDays = options.memberDaysByUser?.[userId] ?? options.defaultMemberDays ?? 400;
      }
      return result;
    },
  };
}

export const DEFAULT_APRS: Readonly<Record<string, number>> = {
  't0-hysa': 4.25,
  'sb-hysa': 4.25,
  'sb-partner-rate': 5.1,
};

export function createFakePricingClient(
  options: FakeBehavior & { aprs?: Readonly<Record<string, number>> } = {},
): PricingClient {
  const aprs = options.aprs ?? DEFAULT_APRS;
  return {
    async getRates({ offerIds }, abort) {
      await simulate(options, abort);
      const rates: Record<string, { apr: number }> = {};
      for (const id of offerIds) {
        const apr = aprs[id];
        if (apr !== undefined) rates[id] = { apr };
      }
      return rates;
    },
  };
}
