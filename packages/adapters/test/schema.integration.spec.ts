import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { Client, Pool, escapeIdentifier, escapeLiteral } from 'pg';
import { readFile, writeFile, chmod } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { migrate, assertSchema, grantControlCapabilities } from '../src/postgres/migrate.js';
const environment = JSON.parse(await readFile('.local/environment.json','utf8')) as { pgPort: number; private: string; syntheticOnly: boolean };
if (!environment.syntheticOnly) throw new Error('SYNTHETIC_REQUIRED');
const password = async (role: string) => (await readFile(`${environment.private}/pg/${role}`,'utf8')).trim();
const connection = (user: string, pass: string, database: string) => ({ host: '127.0.0.1', port: environment.pgPort, user, password: pass, database, max: 1 });
const ids = ['00000000-0000-4000-8000-000000000021', '00000000-0000-4000-8000-000000000022'];
const pools: Pool[] = [];
let bootstrap: Client;
beforeAll(async () => {
  bootstrap = new Client(connection('synthetic_bootstrap',await password('bootstrap'),'postgres')); await bootstrap.connect();
  for (const label of ['central','a','b']) {
    const db = `s01_schema_v4_${label}`; const role = `${db}_m`; const secret = `${environment.private}/pg/${role}`;
    const exists = await bootstrap.query('SELECT d.datname,r.rolname,shobj_description(d.oid,\'pg_database\') AS marker FROM pg_database d JOIN pg_roles r ON d.datdba=r.oid WHERE datname=$1',[db]);
    let value: string;
    if (exists.rows.length) {
      if (exists.rows[0].rolname !== role || exists.rows[0].marker !== 'S01 synthetic schema fixture v4') throw new Error('FIXTURE_OWNER_UNKNOWN');
      value = (await readFile(secret,'utf8')).trim();
    } else {
      if ((await bootstrap.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[role])).rowCount) throw new Error('FIXTURE_ROLE_UNKNOWN');
      value = randomBytes(32).toString('hex'); await writeFile(secret,value,{ flag:'wx',mode:0o400 }); await chmod(secret,0o400);
      await bootstrap.query(`CREATE ROLE ${escapeIdentifier(role)} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT PASSWORD ${escapeLiteral(value)}`);
      await bootstrap.query(`CREATE DATABASE ${escapeIdentifier(db)} OWNER ${escapeIdentifier(role)} ALLOW_CONNECTIONS false`);
      await bootstrap.query(`REVOKE CONNECT,TEMP ON DATABASE ${escapeIdentifier(db)} FROM PUBLIC`);
      await bootstrap.query(`GRANT CONNECT ON DATABASE ${escapeIdentifier(db)} TO ${escapeIdentifier(role)}`);
      await bootstrap.query(`COMMENT ON DATABASE ${escapeIdentifier(db)} IS 'S01 synthetic schema fixture v4'`);
      await bootstrap.query(`ALTER DATABASE ${escapeIdentifier(db)} ALLOW_CONNECTIONS true`);
    }
    const pool = new Pool(connection(role,value,db)); pools.push(pool);
    const client = await pool.connect();
    try { await migrate(client,label==='central'?'control':'agency',label==='central'?undefined:ids[label==='a'?0:1]); } finally { client.release(); }
  }
});
afterAll(async () => { await Promise.all(pools.map(p => p.end())); await bootstrap?.end(); });
async function rollbackQuery(sql: string, values: unknown[] = []) {
  const client = await pools[0]!.connect(); await client.query('BEGIN');
  try { return await client.query(sql,values); } finally { await client.query('ROLLBACK'); client.release(); }
}
describe('S01 real PostgreSQL migrations', () => {
  it('applies central and separate agency schemas and replays identical checksums', async () => {
    for (let i=0;i<3;i++) {
      const client=await pools[i]!.connect();
      try { const kind=i===0?'control':'agency'; const owner=i===0?undefined:ids[i-1]; expect(await migrate(client,kind,owner)).toEqual(await migrate(client,kind,owner)); }
      finally { client.release(); }
    }
  });
  it('rejects adoption under a different agency owner', async () => {
    const client=await pools[1]!.connect();
    try { await expect(migrate(client,'agency',ids[1])).rejects.toThrow('MIGRATION_CLOSED'); }
    finally { client.release(); }
  });
  it('keeps AI, modules and mail disabled in both databases', async () => {
    for (const pool of pools.slice(1)) expect((await pool.query('SELECT automation_enabled,modules_enabled,mail_connected FROM agency_configuration')).rows).toEqual([{automation_enabled:false,modules_enabled:false,mail_connected:false}]);
  });
  it('cannot confirm authority without current epoch and native proof', async () => {
    await expect(rollbackQuery("INSERT INTO identity.account_authority(subject_id,status) VALUES($1,'CONFIRMED')",[ids[0]])).rejects.toMatchObject({code:'23514'});
  });
  it('cannot accept invalid states or dangling membership', async () => {
    await expect(rollbackQuery("INSERT INTO identity.account_authority(subject_id,status) VALUES($1,'BOGUS')",[ids[0]])).rejects.toMatchObject({code:'23514'});
    await expect(rollbackQuery("INSERT INTO identity.membership(subject_id,agency_id,role) VALUES($1,$2,'ADMIN')",ids)).rejects.toMatchObject({code:'23503'});
  });
  it('requires ready schema and activation date; rolls back all associated rows', async () => {
    const client=await pools[0]!.connect(); await client.query('BEGIN');
    try {
      await client.query("INSERT INTO control.agency_invitation(id,root_id,subject_id,contact,owner_id) VALUES($1,$1,$1,'synthetic@example.invalid',$1)",[ids[0]]);
      await expect(client.query("INSERT INTO control.agency(id,invitation_root_id,name,canonical_name_hash,state,activated_at) VALUES($1,$1,'Agence A',$2,'ACTIVE',now())",[ids[0],'a'.repeat(64)])).rejects.toMatchObject({code:'23514'});
    } finally { await client.query('ROLLBACK'); client.release(); }
    expect((await pools[0]!.query('SELECT 1 FROM control.agency_invitation WHERE id=$1',[ids[0]])).rowCount).toBe(0);
  });
  it('requires a root for onboarding and never infers agency access from central session', async () => {
    const client=await pools[0]!.connect(); await client.query('BEGIN');
    try {
      await client.query('INSERT INTO identity.account_authority(subject_id) VALUES($1)',[ids[0]]);
      await expect(client.query("INSERT INTO identity.session(cookie_hash,subject_id,scope,issued_at,last_human_activity_at,absolute_expires_at,epoch,encrypted_oidc_tokens) VALUES($1,$2,'onboarding',now(),now(),now()+interval '10 minutes',1,'synthetic encrypted envelope')",['f'.repeat(64),ids[0]])).rejects.toMatchObject({code:'23514'});
    } finally { await client.query('ROLLBACK'); client.release(); }
  });
  it('enforces stable root and operation uniqueness within a rolled back transaction', async () => {
    const client=await pools[0]!.connect(); await client.query('BEGIN');
    try {
      await client.query("INSERT INTO control.agency_invitation(id,root_id,subject_id,contact,owner_id) VALUES($1,$1,$1,'synthetic@example.invalid',$1)",[ids[0]]);
      await client.query("INSERT INTO control.agency(id,invitation_root_id,name,canonical_name_hash) VALUES($1,$1,'Agence A',$2)",[ids[0],'a'.repeat(64)]);
      await expect(client.query("INSERT INTO control.agency(id,invitation_root_id,name,canonical_name_hash) VALUES($1,$2,'Agence B',$3)",[ids[1],ids[0],'b'.repeat(64)])).rejects.toMatchObject({code:'23505'});
    } finally { await client.query('ROLLBACK'); client.release(); }
  });
  it('rejects incomplete schema and widened PUBLIC grants even with retained marker', async () => {
    const client=await pools[1]!.connect();
    for (const mutation of ['ALTER TABLE agency_configuration RENAME COLUMN modules_enabled TO missing_modules', 'GRANT SELECT ON agency_configuration TO PUBLIC']) {
      await client.query('BEGIN');
      try { await client.query(mutation); await expect(assertSchema(client,'agency')).rejects.toThrow(); }
      finally { await client.query('ROLLBACK'); }
    }
    await assertSchema(client,'agency'); client.release();
  });
  it('rejects invalid journal/enrollment metadata', async () => {
    for (const [column,value] of [['journal_hash',''],['enrollment_status','BOGUS']]) {
      await expect(rollbackQuery(`INSERT INTO identity.account_authority(subject_id,${column}) VALUES($1,$2)`,[ids[0],value])).rejects.toMatchObject({code:'23514'});
    }
  });
  it('runtime cannot perform DDL, identity confirmation or audit mutation; dedicated audit writer cannot update/delete', async () => {
    for (const suffix of ['runtime','audit']) {
      const role=`s01_schema_v4_central_${suffix}`;
      if (!(await bootstrap.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[role])).rowCount) await bootstrap.query(`CREATE ROLE ${escapeIdentifier(role)} NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT`);
    }
    const client=await pools[0]!.connect();
    try { await grantControlCapabilities(client,'s01_schema_v4_central_runtime','s01_schema_v4_central_audit'); } finally { client.release(); }
    const r=await pools[0]!.query(`SELECT has_schema_privilege('s01_schema_v4_central_runtime','control','CREATE') AS ddl,
      has_table_privilege('s01_schema_v4_central_runtime','identity.account_authority','UPDATE') AS identity_update,
      has_table_privilege('s01_schema_v4_central_runtime','control.audit_event','INSERT') AS runtime_audit_insert,
      has_table_privilege('s01_schema_v4_central_audit','control.audit_event','INSERT') AS audit_insert,
      has_table_privilege('s01_schema_v4_central_audit','control.audit_event','UPDATE') AS audit_update,
      has_table_privilege('s01_schema_v4_central_audit','control.audit_event','DELETE') AS audit_delete`);
    expect(r.rows[0]).toEqual({ddl:false,identity_update:false,runtime_audit_insert:false,audit_insert:true,audit_update:false,audit_delete:false});
  });
  it('denies PUBLIC connect/temp and cross-database migration credentials', async () => {
    const publicAcl = await bootstrap.query("SELECT count(*)::int n FROM pg_database d, LATERAL aclexplode(coalesce(d.datacl,acldefault('d',d.datdba))) a WHERE datname LIKE 's01_schema_v4_%' AND a.grantee=0");
    expect(publicAcl.rows[0].n).toBe(0);
    const wrong=new Client(connection('s01_schema_v4_a_m',await password('s01_schema_v4_a_m'),'s01_schema_v4_b'));
    await expect(wrong.connect()).rejects.toMatchObject({code:'42501'}); await wrong.end();
  });
});
