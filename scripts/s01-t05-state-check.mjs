#!/usr/bin/env node
/** Read-only retained synthetic T05 state inspection; prints aggregate counts only. */
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
execFileSync('python3',['scripts/s01-worktree-identity-check.py',process.cwd()],{stdio:'ignore'});
const env=JSON.parse(await readFile('.local/environment.json','utf8'));
if(!env.syntheticOnly||env.root!==process.cwd())throw new Error('SYNTHETIC_REQUIRED');
const require=createRequire(new URL('../packages/adapters/package.json',import.meta.url));
const {Pool}=require('pg');
const pool=new Pool({host:'127.0.0.1',port:env.pgPort,database:'control',user:'control_api',max:1,
  password:(await readFile(`${env.private}/pg/control_api`,'utf8')).trim()});
try{
  const row=(await pool.query(`WITH owned AS (
    SELECT DISTINCT a.id FROM control.agency a JOIN control.idempotency_record i ON i.resource_id=a.invitation_root_id
    WHERE i.operation_type='t05.agency-create.v1'
  ) SELECT count(*)::int AS agencies,
    count(*) FILTER(WHERE a.state<>'PROVISIONING' OR a.activated_at IS NOT NULL OR a.ready_schema_version IS NOT NULL)::int AS not_closed,
    count(*) FILTER(WHERE o.id IS NULL OR o.step<>'ACCEPTED' OR o.status<>'PENDING')::int AS invalid_operations,
    count(*) FILTER(WHERE m.subject_id IS NULL OR m.role<>'ADMIN' OR m.state NOT IN('PENDING','DENIED'))::int AS invalid_memberships,
    count(*) FILTER(WHERE l.agency_id IS NOT NULL)::int AS locators
    FROM owned JOIN control.agency a ON a.id=owned.id
    LEFT JOIN control.provisioning_operation o ON o.agency_id=a.id
    LEFT JOIN identity.membership m ON m.agency_id=a.id
    LEFT JOIN control.database_locator l ON l.agency_id=a.id`)).rows[0];
  const terminal=(await pool.query(`SELECT count(*)::int AS invalid FROM control.agency_invitation a
    WHERE a.status='REVOKED' AND (a.token_hash IS NOT NULL OR a.expires_at IS NOT NULL)
    AND EXISTS(SELECT 1 FROM control.idempotency_record i WHERE i.resource_id=a.root_id AND i.operation_type='t05.invitation-create.v1')`)).rows[0];
  if(!row||row.agencies<1||row.not_closed||row.invalid_operations||row.invalid_memberships||row.locators||terminal.invalid)throw new Error('T05_STATE_NOT_CLOSED');
  process.stdout.write(JSON.stringify({syntheticOnly:true,actualPostgres:true,t05AgenciesInspected:row.agencies,
    allProvisioning:true,allOperationsAcceptedPending:true,allMembershipsAdminPendingOrRevokedDenied:true,
    activeOrReady:0,locators:0,revokedWithLiveToken:0})+'\n');
}finally{await pool.end();}
