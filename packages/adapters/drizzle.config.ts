import { defineConfig } from 'drizzle-kit';
const agency = process.env['S01_SCHEMA'] === 'agency';
export default defineConfig({ dialect: 'postgresql', schema: `./packages/adapters/src/postgres/${agency ? 'agency' : 'control'}.schema.ts`, out: `./.local/generated-${agency ? 'agency' : 'control'}` });
