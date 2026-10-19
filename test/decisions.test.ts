import { inspect } from 'node:util';
import { describe, expect, it } from 'vitest';
import { personalize } from '../src/core/engine';
import { Redacted } from '../src/core/redacted';
import { signalsFromClaims } from '../src/core/signals';
import { switchback } from '../src/tenants/switchback';
import { findValues, switchbackUser, testDeps } from './helpers';

describe('decision records', () => {
  it('explain why an offer was or was not shown, from the record alone', async () => {
    const { decision } = await personalize(
      { tenant: 'switchback', surface: 'offers', user: switchbackUser({ tenureMonths: 3, earningsUsd: 5_000 }) },
      switchback,
      testDeps(),
    );
    expect(decision).toMatchObject({
      decisionId: 'decision-test',
      tenant: 'switchback',
      surface: 'offers',
      configVersion: switchback.version,
      degraded: false,
      fallbackUsed: false,
      dependencies: { profile: { status: 'skipped' }, pricing: { status: 'ok' } },
    });
    expect(decision.offers).toEqual([
      { offerId: 'sb-hysa', kind: 'baseline', shown: true, reasons: [] },
      {
        offerId: 'sb-partner-rate',
        kind: 'exclusive',
        shown: false,
        reasons: ['tenureMonths >= 6: fail', 'monthlyEarningsUsd >= 2000: pass'],
      },
    ]);
  });
});

describe('sensitive signals', () => {
  const tenureMonths = 9137;
  const earningsUsd = 86421;
  const user = switchbackUser({ tenureMonths, earningsUsd });

  it('are wrapped as soon as they are read from claims', () => {
    const signals = signalsFromClaims(switchback, user.claims);
    expect(signals.tenureMonths).toBeInstanceOf(Redacted);
    expect(JSON.stringify(signals)).toBe('{"tenureMonths":"[redacted]","monthlyEarningsUsd":"[redacted]"}');
    expect(inspect(signals)).not.toMatch(/9137|86421/);
    expect(`${signals.monthlyEarningsUsd}`).toBe('[redacted]');
  });

  it('never appear in the response or the decision record', async () => {
    const result = await personalize({ tenant: 'switchback', surface: 'offers', user }, switchback, testDeps());
    expect(findValues(JSON.parse(JSON.stringify(result)), [tenureMonths, earningsUsd])).toEqual([]);
  });
});
