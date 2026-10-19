import { readSignal, type Signals } from './signals';
import type { SignalKey } from './types';

/**
 * The engine's vocabulary of rules. Adding a rule is an engine change (a new capability every tenant can use), not a per-tenant change.
 */
export type Rule =
  | { type: 'minTenureMonths'; months: number }
  | { type: 'minMonthlyEarningsUsd'; usd: number }
  | { type: 'minMemberDays'; days: number };

interface RuleDefinition<R extends Rule> {
  signal: SignalKey;
  describe: (rule: R) => string;
  passes: (value: number, rule: R) => boolean;
}

type RuleDefinitions = { [T in Rule['type']]: RuleDefinition<Extract<Rule, { type: T }>> };

const RULE_DEFINITIONS: RuleDefinitions = {
  minTenureMonths: {
    signal: 'tenureMonths',
    describe: (rule) => `tenureMonths >= ${rule.months}`,
    passes: (value, rule) => value >= rule.months,
  },
  minMonthlyEarningsUsd: {
    signal: 'monthlyEarningsUsd',
    describe: (rule) => `monthlyEarningsUsd >= ${rule.usd}`,
    passes: (value, rule) => value >= rule.usd,
  },
  minMemberDays: {
    signal: 'memberDays',
    describe: (rule) => `memberDays >= ${rule.days}`,
    passes: (value, rule) => value >= rule.days,
  },
};

function definitionFor<R extends Rule>(rule: R): RuleDefinition<R> {
  return RULE_DEFINITIONS[rule.type] as unknown as RuleDefinition<R>;
}

export function signalFor(rule: Rule): SignalKey {
  return definitionFor(rule).signal;
}

export interface RuleOutcome {
  pass: boolean;
  reason: string;
}

/** Fails closed: a missing signal means the rule does not pass. */
export function evaluateRule(rule: Rule, signals: Signals): RuleOutcome {
  const definition = definitionFor(rule);
  const label = definition.describe(rule);
  const value = signals[definition.signal];
  if (value === undefined) {
    return { pass: false, reason: `${label}: signal unavailable` };
  }
  const pass = definition.passes(readSignal(value), rule);
  return { pass, reason: `${label}: ${pass ? 'pass' : 'fail'}` };
}
