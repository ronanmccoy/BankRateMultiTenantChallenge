import Fastify, { type FastifyServerOptions } from 'fastify';
import { personalize, type EngineDeps } from '../core/engine';
import type { TenantRegistry } from '../core/registry';
import { SURFACES, type PersonalizeRequest } from '../core/types';

export interface ServerDeps extends EngineDeps {
  registry: TenantRegistry;
}

/** The only tenant that existed before this change. */
export const LEGACY_DEFAULT_TENANT = 'tenant0';

const personalizeBodySchema = {
  type: 'object',
  required: ['surface', 'user'],
  additionalProperties: false,
  properties: {
    tenant: { type: 'string', minLength: 1, default: LEGACY_DEFAULT_TENANT },
    surface: { type: 'string', enum: SURFACES },
    user: {
      type: 'object',
      required: ['id', 'claims'],
      additionalProperties: false,
      properties: {
        id: { type: 'string', minLength: 1 },
        claims: { type: 'object' },
      },
    },
  },
} as const;

export function buildServer(deps: ServerDeps, options: FastifyServerOptions = {}) {
  const app = Fastify(options);

  app.post<{ Body: PersonalizeRequest }>(
    '/v1/personalize',
    { schema: { body: personalizeBodySchema } },
    async (request, reply) => {
      const config = deps.registry.get(request.body.tenant);
      if (!config) return reply.code(400).send({ error: 'unknown_tenant' });

      const { response, decision, violations } = await personalize(request.body, config, deps);

      // Structured log -> New Relic (short-term debugging) and Firehose -> S3 (audit). See RFC Section 7.
      request.log.info({ decision }, 'personalization.decision');

      if (violations.length > 0) {
        // Alert on any non-zero count.
        request.log.error(
          { tenant: decision.tenant, decisionId: decision.decisionId, violations },
          'personalization.isolation_violation',
        );
      }

      return response;
    },
  );

  return app;
}
