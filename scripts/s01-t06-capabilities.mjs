import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const pg = createRequire(new URL('../packages/adapters/package.json', import.meta.url))('pg');
const { Client } = pg;
const env = JSON.parse(await readFile('.local/environment.json', 'utf8'));
if (env.syntheticOnly !== true || env.root !== process.cwd())
    throw new Error('SYNTHETIC_REQUIRED');
const bootstrap = (await readFile(`${env.private}/pg/bootstrap`, 'utf8')).trim();
const client = new Client({ host: '127.0.0.1', port: env.pgPort, database: 'postgres', user: 'synthetic_bootstrap', password: bootstrap });
try {
    await client.connect();
    const found = await client.query("SELECT rolcanlogin,rolsuper,rolcreatedb,rolcreaterole,rolinherit,rolreplication,rolbypassrls FROM pg_roles WHERE rolname='control_t06'");
    if (!found.rows.length) {
        await client.query('CREATE ROLE control_t06 NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS');
        await client.query('GRANT control_t06 TO provisioner WITH INHERIT FALSE, SET TRUE, ADMIN FALSE');
    }
    const audit = (await client.query("SELECT admin_option,inherit_option,set_option FROM pg_auth_members WHERE roleid='control_audit'::regrole AND member='provisioner'::regrole")).rows;
    if (audit.length === 0)
        await client.query('GRANT control_audit TO provisioner WITH INHERIT FALSE, SET TRUE, ADMIN FALSE');
    else if (audit.length !== 1 || audit[0].admin_option !== false || audit[0].inherit_option !== false || audit[0].set_option !== true)
        throw new Error('T06_AUDIT_CAPABILITY_DIVERGED');
    const membership = await client.query("SELECT r.rolname AS role,m.rolname AS member,a.admin_option,a.inherit_option,a.set_option FROM pg_auth_members a JOIN pg_roles r ON r.oid=a.roleid JOIN pg_roles m ON m.oid=a.member WHERE r.rolname='control_t06' OR m.rolname='control_t06'");
    const role = found.rows[0] ?? (await client.query("SELECT rolcanlogin,rolsuper,rolcreatedb,rolcreaterole,rolinherit,rolreplication,rolbypassrls FROM pg_roles WHERE rolname='control_t06'")).rows[0];
    if (Object.values(role).some(v => v !== false) || membership.rows.length !== 1 || membership.rows[0].role !== 'control_t06' || membership.rows[0].member !== 'provisioner' || membership.rows[0].admin_option !== false || membership.rows[0].inherit_option !== false || membership.rows[0].set_option !== true)
        throw new Error('T06_CAPABILITY_DIVERGED');
}
finally {
    await client.end();
}
