import { defineConfig } from 'vitest/config';

export default defineConfig({ test: { projects: [
  { test: { name: 'unit', include: ['packages/*/test/*.spec.ts', 'apps/api/test/*.unit.spec.ts'], exclude: ['**/*.integration.spec.ts'] } },
  { test: { name: 'contracts', include: ['apps/api/test/agency.contract.spec.ts'] } },
  { test: { name: 'integration', include: ['packages/*/test/*.integration.spec.ts', 'apps/api/test/*.integration.spec.ts'], testTimeout: 30000, fileParallelism: false } },
] } });
