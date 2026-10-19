# Personalization Service: Multi-Tenant Prototype

A tenant-aware personalization service that serves both tenant 0 (our own members) and Switchback (an embedded partner) from one code path.

- **Design (Part 1):** [`docs/RFC-multi-tenant-personalization.md`](docs/RFC-multi-tenant-personalization.md)
- **Prototype (Part 2):** this repo; see Install, Run and Test below
- **Bringing the squad along (Part 3):** [`docs/SQUAD.md`](docs/SQUAD.md)
- **Where I'd continue:** [below](#where-id-continue)

## Requirements

- Node.js 22.12 or later (required by Vitest 5)
- npm

## Install

```bash
npm install
```

## Run

```bash
npm run dev      # starts on http://localhost:3000 and restarts on file changes
npm start        # starts without watching
```

**Assumption:** the profile and pricing services are in-memory fakes with injectable failure modes, since the real services are out of scope for this exercise. To simulate an outage, set `FAKE_PROFILE` or `FAKE_PRICING` to `error` or `slow`:

```bash
FAKE_PRICING=error npm run dev
```

Set `PORT` to use a different port.

### Example requests

Tenant 0 member:

```bash
curl -s -X POST http://localhost:3000/v1/personalize \
  -H 'content-type: application/json' \
  -d '{"tenant":"tenant0","surface":"offers","user":{"id":"member-1","claims":{}}}'
```

Switchback user (signals arrive as SSO claims):

```bash
curl -s -X POST http://localhost:3000/v1/personalize \
  -H 'content-type: application/json' \
  -d '{"tenant":"switchback","surface":"offers","user":{"id":"worker-1","claims":{"sb_tenure_months":8,"sb_monthly_earnings_usd":4100}}}'
```

`surface` is `offers` or `dashboard`.

More examples, including an ineligible Switchback user, a cross-tenant claims attempt and error cases, are in [`requests.http`](requests.http). You can run them with one click in the VS Code REST Client extension or a JetBrains IDE.

The same requests are available as a Postman collection: in Postman, choose **Import** and select [`postman/personalization.postman_collection.json`](postman/personalization.postman_collection.json). The collection sets `baseUrl` to `http://localhost:3000`, and each request checks its expected status code.

## Test

```bash
npm test             # run all tests once
npm run test:watch   # re-run on file changes
npm run typecheck    # TypeScript type check
```

| Test file | What it covers |
|---|---|
| `test/isolation.test.ts` | No tenant ever receives another tenant's exclusive offers; egress guard; startup config validation |
| `test/degraded.test.ts` | Safe, tenant-appropriate responses when profile or pricing is slow or down |
| `test/decisions.test.ts` | Decision records explain each outcome; sensitive signals are never exposed |
| `test/http.test.ts` | The `POST /v1/personalize` endpoint, request validation, and log redaction |

## Docs

- [RFC](docs/RFC-multi-tenant-personalization.md)
- [Squad writeup](docs/SQUAD.md)

## Where I'd continue

I stopped just a few minutes beyond the brief's 3-hour limit. I spent the time on the parts the brief says it's evaluating: the seam between engine and tenant config, isolation, degraded mode, and explainable decisions. All of those are built and tested. Safe rollout is designed in the RFC (Section 5.1) but mostly not built. Here's what I'd do next, in order:

1. **Per-tenant kill switch.** A flag that drops a tenant to fallback-only without a deploy, with a test proving that switching off Switchback doesn't change tenant 0. It's the RFC's first recovery step, and the cheapest way to back "never put tenant 0 at risk" with code.
2. **Take `tenant` from the gateway, not the body.** Read it from verified request context (A3) and keep the body field only for the transitional tenant 0 default.
3. **Shadow-diff harness for tenant 0.** Run old and new paths side by side, sharing one set of dependency responses, and report diffs on offer IDs and reasons. This unlocks rollout stages 1–2.
4. **Real profile and pricing clients** behind the existing ports, with connection pooling and a circuit breaker per dependency.
5. **Decision records to S3** through Firehose, plus New Relic alerts on egress-guard violations and on the `signal unavailable` rate per tenant.
6. **Load test** at 5k RPS to confirm the latency budget and ECS sizing, and find out whether pricing needs the tenant-keyed cache.

**Deliberately not built:** a frontend (the brief asks for an endpoint; rendering belongs to each tenant's app), self-serve partner onboarding, and per-tenant infrastructure.

