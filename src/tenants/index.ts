import { createRegistry } from '../core/registry';
import { switchback } from './switchback';
import { tenant0 } from './tenant0';

/**
 * Adding a tenant: create its config file and add it to this list.
 * Startup validation and the CI isolation suite pick it up automatically.
 */
export const tenantRegistry = createRegistry([tenant0, switchback]);
