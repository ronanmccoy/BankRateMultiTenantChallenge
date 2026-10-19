import { createFakePricingClient, createFakeProfileClient, type FakeMode } from './adapters/fakes';
import { buildServer } from './http/server';
import { tenantRegistry } from './tenants';

// Simulate outages locally, e.g. `FAKE_PRICING=error npm run dev`.
const FAKE_MODES: readonly FakeMode[] = ['ok', 'error', 'slow'];

function modeFromEnv(name: string): FakeMode {
  const value = process.env[name] ?? 'ok';
  if (!FAKE_MODES.includes(value as FakeMode)) {
    throw new Error(`${name} must be one of: ${FAKE_MODES.join(', ')} (got "${value}")`);
  }
  return value as FakeMode;
}

const app = buildServer(
  {
    registry: tenantRegistry,
    profile: createFakeProfileClient({ mode: modeFromEnv('FAKE_PROFILE'), latencyMs: 15 }),
    pricing: createFakePricingClient({ mode: modeFromEnv('FAKE_PRICING'), latencyMs: 25 }),
  },
  { logger: true },
);

await app.listen({ port: Number(process.env.PORT ?? 3000) });
