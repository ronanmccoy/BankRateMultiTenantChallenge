import { describe, expect, it } from 'vitest';
import { buildServer } from '../src/http/server';
import { tenantRegistry } from '../src/tenants';
import { findValues, switchbackUser, tenant0Member, testDeps } from './helpers';

function testServer() {
  const logs: Record<string, unknown>[] = [];
  const app = buildServer(
    { registry: tenantRegistry, ...testDeps() },
    {
      logger: {
        level: 'info',
        stream: { write: (line: string) => void logs.push(JSON.parse(line)) },
      },
    },
  );
  return { app, logs };
}

describe('POST /v1/personalize', () => {
  it('serves tenant 0 and Switchback from the same endpoint', async () => {
    const { app } = testServer();

    const member = await app.inject({
      method: 'POST',
      url: '/v1/personalize',
      payload: { tenant: 'tenant0', surface: 'offers', user: tenant0Member },
    });
    const worker = await app.inject({
      method: 'POST',
      url: '/v1/personalize',
      payload: { tenant: 'switchback', surface: 'offers', user: switchbackUser() },
    });

    expect(member.statusCode).toBe(200);
    expect(member.json().offers.map((o: { id: string }) => o.id)).toEqual(['t0-hysa', 't0-member-rewards-card']);
    expect(worker.statusCode).toBe(200);
    expect(worker.json().offers).toEqual([
      { id: 'sb-hysa', title: 'High-yield savings account', kind: 'baseline', rate: { apr: 4.25 } },
      { id: 'sb-partner-rate', title: 'Switchback Partner Rate savings', kind: 'exclusive', rate: { apr: 5.1 } },
    ]);
  });

  it('treats a request without a tenant as tenant 0, so existing callers keep working', async () => {
    const { app } = testServer();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/personalize',
      payload: { surface: 'offers', user: tenant0Member },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().tenant).toBe('tenant0');
    expect(res.json().offers.map((o: { id: string }) => o.id)).toEqual(['t0-hysa', 't0-member-rewards-card']);
  });

  it('rejects an unknown tenant', async () => {
    const { app } = testServer();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/personalize',
      payload: { tenant: 'acme', surface: 'offers', user: tenant0Member },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: 'unknown_tenant' });
  });

  it('rejects a malformed request', async () => {
    const { app } = testServer();
    const res = await app.inject({ method: 'POST', url: '/v1/personalize', payload: { tenant: 'tenant0' } });
    expect(res.statusCode).toBe(400);
  });

  it('logs a decision record without raw sensitive values', async () => {
    const { app, logs } = testServer();
    await app.inject({
      method: 'POST',
      url: '/v1/personalize',
      payload: { tenant: 'switchback', surface: 'offers', user: switchbackUser({ tenureMonths: 9137, earningsUsd: 86421 }) },
    });
    expect(logs.some((line) => line.msg === 'personalization.decision')).toBe(true);
    expect(findValues(logs, [9137, 86421])).toEqual([]);
  });
});
