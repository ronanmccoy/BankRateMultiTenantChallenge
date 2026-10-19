# Part 3: Bringing the Squad Along

**Team:** me (senior), a mid-level engineer, an associate engineer. A few sprints.

## How I'd split the work

| Who | Owns | Why them |
|---|---|---|
| **Me** | Isolation invariants (egress guard, `Redacted`, startup validation), the tenant-resolution contract with the gateway team (RFC assumption A3), the rollout plan, and partner/contract questions (retention, what counts as sensitive) | These are the parts where a mistake is a contract breach, not a bug. They also need cross-team conversations the others shouldn't have to carry yet. |
| **Mid-level** | Degraded mode for real: production profile and pricing clients behind the existing ports, timeouts, a circuit breaker; then the tenant 0 shadow-diff harness for rollout stages 1–2 | A production-critical slice with clear deliverables. They own it end to end, including the runbook and dashboards, which is the step from "ships tickets" to "owns a system". |
| **Associate** | Tenant config and rule types: Switchback's config, new rule types with tests, decision-record queries and New Relic dashboards for support | Small, well-bounded changes with a strong safety net: the isolation suite runs on every PR, so mistakes fail in CI, not in production. Adding a rule type end to end teaches the whole request path. |

## What I'd review closely

- Anything in `src/core/egress-guard.ts`, `redacted.ts`, `validate.ts` or the signal-reading path. I'd make these CODEOWNERS-protected, so review is enforced, not remembered.
- Tenant config changes to `kind`, `visibleTo` or `sensitiveSignals`. The associate owns tenant config, but these fields are where an isolation or data-handling mistake would start.
- Any new log line or decision-record field: could it carry a sensitive value?
- Cache keys and anything shared across requests: a key without the tenant in it is an isolation bug waiting to happen.
- Timeout and latency changes against the 200ms p99 budget.
- Rollout flag changes, especially anything that could touch tenant 0.

Everything else they review for each other, with me as a second reviewer, not a gate.

## Setting them up to succeed (not just handing out tickets)

- **Start from the why.** A kickoff walking through the RFC, focused on the seam and the isolation layers, so they can make the next call themselves instead of asking me.
- **Design before code.** Each of them writes a short plan for their slice before starting. I comment on it; it's cheaper to redirect a plan than a PR.
- **Pair first, then step back.** I pair with the associate on the first rule type and with the mid-level on the first adapter, then hand over the keyboard for the rest.
- **Ownership is visible.** The mid-level presents the degraded-mode design at our team review and is on point during the tenant 0 ramp, with me as backup. The associate writes the "how to add a tenant" doc. If they can explain it, they understand it.
- **Name the growth goal.** For the mid-level: owning a production system and its operations. For the associate: confidently shipping changes to a service with real safety constraints. We check in on those goals, not just ticket status.
