import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const { Client } = createRequire(new URL('../packages/adapters/package.json', import.meta.url))('pg');
const env = JSON.parse(await readFile('.local/environment.json', 'utf8'));
if (env.syntheticOnly !== true || env.root !== process.cwd()) throw new Error('SYNTHETIC_REQUIRED');
const password = (await readFile(`${env.private}/pg/bootstrap`, 'utf8')).trim();
const client = new Client({ host:'127.0.0.1', port:env.pgPort, database:'postgres', user:'synthetic_bootstrap', password });
try {
  await client.connect();
  for (const [role, member] of [['control_t07','control_coordinator'],['control_t07_local_reader','provisioner']]) {
    const found = (await client.query('SELECT oid FROM pg_roles WHERE rolname=$1',[role])).rows[0];
    if (!found) {
      await client.query(`CREATE ROLE ${role} NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS`);
      await client.query(`GRANT ${role} TO ${member} WITH INHERIT FALSE, SET TRUE, ADMIN FALSE`);
    }
  }
  const memberships=(await client.query(`SELECT r.rolname AS role,m.rolname AS member,a.admin_option,a.inherit_option,a.set_option
    FROM pg_auth_members a JOIN pg_roles r ON r.oid=a.roleid JOIN pg_roles m ON m.oid=a.member
    WHERE r.rolname IN ('control_t07','control_t07_local_reader') OR m.rolname IN ('control_t07','control_t07_local_reader')`)).rows;
  const expected=[['control_t07','control_coordinator'],['control_t07_local_reader','provisioner']];
  if(memberships.length!==2||expected.some(([role,member])=>!memberships.some(row=>row.role===role&&row.member===member
    &&row.admin_option===false&&row.inherit_option===false&&row.set_option===true)))throw new Error('T07_CAPABILITY_DIVERGED');
  process.stdout.write(JSON.stringify({syntheticOnly:true,roles:2,exactMemberships:true})+'\n');
} finally { await client.end(); }
