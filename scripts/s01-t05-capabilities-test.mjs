// SQL-boundary tests only. PostgreSQL semantics and effective privileges require 0b.
import assert from 'node:assert/strict';
import { assertT05Capabilities, assertT05Role, grantT05Capabilities } from '../packages/adapters/src/postgres/t05-capabilities.ts';

const role = { rolcanlogin: false, rolsuper: false, rolcreatedb: false, rolcreaterole: false,
  rolinherit: false, rolreplication: false, rolbypassrls: false };
const membership = { role: 'control_t05', member: 'control_coordinator', admin_option: false,
  inherit_option: false, set_option: true };
const grants = [];
let schemas, tables, columns;
function reset() { schemas = []; tables = []; columns = []; grants.length = 0; }
reset();
const client = { async query(sql) {
  if (sql.includes('FROM pg_roles WHERE')) return { rows: [role] };
  if (sql.includes('FROM pg_auth_members')) return { rows: [membership] };
  if (sql.includes(' AS owns')) return { rows: [{ owns: false }] };
  if (sql.startsWith('GRANT')) {
    grants.push(sql);
    if (sql.startsWith('GRANT USAGE')) {
      schemas = ['control', 'identity'].map(nspname => ({ nspname, privilege_type: 'USAGE', is_grantable: false }));
    } else {
      const [, privilege, fields, resources] = sql.match(/^GRANT (\w+)(?:\(([^)]+)\))? ON (.+) TO control_t05$/);
      for (const resource of resources.split(',')) {
        const [nspname, relname] = resource.split('.');
        if (fields) {
          for (const attname of fields.split(',')) columns.push({ nspname, relname, attname, privilege_type: privilege, is_grantable: false });
        } else tables.push({ nspname, relname, privilege_type: privilege, is_grantable: false });
      }
    }
    return { rows: [] };
  }
  if (sql.includes('FROM pg_namespace n,')) return { rows: schemas };
  if (sql.includes('FROM pg_class c JOIN')) return { rows: tables };
  if (sql.includes('FROM pg_attribute t JOIN')) return { rows: columns };
  if (sql.includes('FROM pg_proc p,')) return { rows: [{ n: 0 }] };
  throw new Error('Unexpected SQL');
} };
let cases = 0;
await grantT05Capabilities(client);
await assertT05Capabilities(client);
assert.equal(grants.length, 8);
assert.equal(columns.some(row => row.attname === 'state' || row.attname === 'identity_status'), false);
assert.equal(tables.some(row => ['session', 'account_authority', 'outbox', 'audit_event', 'database_locator'].includes(row.relname)), false);
cases++;
for (const field of Object.keys(role)) {
  role[field] = true;
  await assert.rejects(assertT05Role(client), /T05_ROLE_DIVERGED/);
  role[field] = false;
  cases++;
}
for (const [field, invalid] of Object.entries({ member: 'control_migrator', role: 'control_api',
  admin_option: true, inherit_option: true, set_option: false })) {
  const original = membership[field]; membership[field] = invalid;
  await assert.rejects(assertT05Role(client), /T05_MEMBERSHIP_DIVERGED/);
  membership[field] = original; cases++;
}
tables.push({ nspname: 'identity', relname: 'session', privilege_type: 'UPDATE', is_grantable: false });
await assert.rejects(assertT05Capabilities(client), /T05_OBJECT_ACL_DIVERGED/); tables.pop(); cases++;
columns[0].is_grantable = true;
await assert.rejects(assertT05Capabilities(client), /T05_GRANT_OPTION_REFUSED/);
columns[0].is_grantable = false; cases++;
columns.pop();
await assert.rejects(assertT05Capabilities(client), /T05_OBJECT_ACL_DIVERGED/); cases++;
console.log(JSON.stringify({ capabilityBoundaryCasesPassed: cases, actualPostgres: false, servicesStarted: 0 }));
