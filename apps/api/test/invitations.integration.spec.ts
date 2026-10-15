import { randomBytes,randomUUID } from 'node:crypto';
import { describe,expect,it } from 'vitest';
import { onboardingReceiptKey } from '@dossiercle/adapters/identity/onboarding-receipt';
import { t05Hash } from '@dossiercle/adapters/postgres/t05.repository';
import { AgenciesService } from '../src/agencies/agencies.service.js';
import { fixture,pool,observer,journal } from './private-t05-fixture.js';

describe('T05 real invitation service issue -> preparation -> grant, pre-refresh guard',()=>{
  it('refuses stale If-Match on PENDING before native reconciliation or refresh and preserves the same session',async()=>{
    const f=await fixture(),pending=await f.pending();const before=await f.snapshot(pending.subjectId),authBefore=f.authorizationChecks();
    expect((await f.service.get(f.cookie,pending.invitationId)).status).toBe('PENDING_IDENTITY');
    await expect(f.service.issue(f.request(0n),pending.invitationId)).rejects.toThrow('VERSION_CONFLICT');
    expect(await f.snapshot(pending.subjectId)).toEqual(before);expect(f.authorizationChecks()).toBeGreaterThan(authBefore);
    expect((await f.auth.session(f.cookie)).scope).toBe('platform');
    f.healthy();const issued=await f.service.issue(f.request(1n),pending.invitationId);
    expect(issued.status).toBe('ISSUED');expect('enrollmentUrl' in issued).toBe(true);
  });
  it('refuses an issue key already used for another invitation body before PENDING reconciliation or refresh',async()=>{
    const f=await fixture(),first=await f.pending(),second=await f.pending();f.healthy();const key=randomUUID();
    await f.service.issue(f.request(1n,key),first.invitationId);
    const before=await f.snapshot(second.subjectId);
    await expect(f.service.issue(f.request(1n,key),second.invitationId)).rejects.toThrow('IDEMPOTENCY_CONFLICT');
    expect(await f.snapshot(second.subjectId)).toEqual(before);
    expect((await f.auth.session(f.cookie)).scope).toBe('platform');
  });
  it('accepts authorized replay before stale If-Match, projects current state and never repeats native preparation',async()=>{
    const f=await fixture(),pending=await f.pending();f.healthy();const key=randomUUID();
    const first=await f.service.issue(f.request(1n,key),pending.invitationId);expect(first.status).toBe('ISSUED');
    const nativeCalls={user:f.calls.user,create:f.calls.create};
    const replay=await f.service.issue(f.request(0n,key),pending.invitationId);
    expect(replay).toEqual({invitationId:pending.invitationId,status:'ISSUED',version:'2'});
    expect({user:f.calls.user,create:f.calls.create}).toEqual(nativeCalls);
    expect((await f.auth.session(f.cookie)).scope).toBe('platform');
  });
  it('resumes a PENDING durable command after transaction-boundary interruption before checking stale If-Match',async()=>{
    const f=await fixture(),pending=await f.pending();f.healthy();const key=randomUUID();f.interruptNextExecution();
    await expect(f.service.issue(f.request(1n,key),pending.invitationId)).rejects.toThrow('SYNTHETIC_BETWEEN_TRANSACTIONS');
    const row=(await observer.query('SELECT status,version FROM control.agency_invitation WHERE id=$1',[pending.invitationId])).rows[0];
    expect(row).toEqual({status:'PENDING_IDENTITY',version:'1'});
    expect((await observer.query("SELECT 1 FROM control.idempotency_record WHERE actor_id=$1 AND operation_type='t05.issue-command.v1' AND key=$2",[f.owner,key])).rowCount).toBe(1);
    const creates=f.calls.create;
    const issued=await f.service.issue(f.request(0n,key),pending.invitationId);
    expect(issued.status).toBe('ISSUED');expect(issued.version).toBe('2');expect('enrollmentUrl' in issued).toBe(true);
    expect(f.calls.create).toBe(creates);expect((await f.auth.session(f.cookie)).scope).toBe('platform');
  });

  it('retains durable PENDING after native response loss, reads the reserved UUID on retry, and stores no raw grant token',async()=>{
    const f=await fixture(),pending=await f.pending();
    const reserved=(await observer.query('SELECT status,identity_status,subject_id FROM control.agency_invitation WHERE id=$1',[pending.invitationId])).rows[0];
    expect(reserved).toEqual({status:'PENDING_IDENTITY',identity_status:'PENDING',subject_id:pending.subjectId});
    const creates=f.calls.create;f.healthy();const issued=await f.service.issue(f.request(),pending.invitationId);
    expect(f.calls.create).toBe(creates);expect(f.calls.user).toBeGreaterThan(1);
    expect('enrollmentUrl' in await f.service.get(f.cookie,pending.invitationId)).toBe(false);
    const token=new URLSearchParams(new URL(issued.enrollmentUrl!).hash.slice(1)).get('token')!;
    const records=await observer.query('SELECT result FROM control.idempotency_record WHERE resource_id=$1',[pending.rootId]);
    expect(JSON.stringify(records.rows).includes(token)).toBe(false);
    const stored=(await observer.query('SELECT token_hash,expires_at FROM control.agency_invitation WHERE id=$1',[pending.invitationId])).rows[0];
    expect(stored.token_hash).toMatch(/^[a-f0-9]{64}$/);expect(stored.token_hash===token).toBe(false);
    expect(stored.expires_at.getTime()-Date.now()).toBeGreaterThan(590_000);
    expect(stored.expires_at.getTime()-Date.now()).toBeLessThanOrEqual(600_000);
  });
  it('claims with server receipt, creates one durable PROVISIONING agency and recovers the same operation with GET/replays',async()=>{
    const f=await fixture(),pending=await f.pending();f.healthy();const issued=await f.service.issue(f.request(),pending.invitationId),guest=await f.enroll(issued);
    expect(await f.agencies.get(guest.cookie)).toBeNull();
    expect(await f.agencies.claim(guest.request(),{})).toEqual({invitationId:pending.invitationId,status:'CLAIMED'});
    expect(await f.agencies.claim(guest.request(),{token:guest.token})).toEqual({invitationId:pending.invitationId,status:'CLAIMED'});
    const key=randomUUID(),created=await f.agencies.create(guest.request(key),'  Agence e\u0301cole  ');
    expect(created.state).toBe('PROVISIONING');expect(created.version).toBe('1');
    expect(await f.agencies.create(guest.request(key),'Agence école')).toEqual(created);
    expect(await f.agencies.create(guest.request(),'Agence école')).toEqual(created);
    expect(await f.agencies.get(guest.cookie)).toEqual(created);
    const result=(await observer.query(`SELECT a.name,a.state,EXISTS(SELECT 1 FROM control.database_locator l WHERE l.agency_id=a.id) AS has_locator,m.role,m.state AS membership_state,o.step,o.status
      FROM control.agency a JOIN identity.membership m ON m.agency_id=a.id JOIN control.provisioning_operation o ON o.agency_id=a.id
      WHERE a.invitation_root_id=$1`,[pending.rootId])).rows;
    expect(result).toHaveLength(1);expect(result[0]).toEqual({name:'Agence école',state:'PROVISIONING',has_locator:false,role:'ADMIN',membership_state:'PENDING',step:'ACCEPTED',status:'PENDING'});
    const events=(await observer.query("SELECT event_type,count(*)::int AS n FROM control.audit_event WHERE resource_id=$1 GROUP BY event_type",[pending.rootId])).rows;
    expect(events.find(row=>row.event_type==='invitation.claimed')?.n).toBe(1);expect(events.find(row=>row.event_type==='agency.creation-accepted')?.n).toBe(1);
    const before=await journal.head(guest.subject),session=(await pool.query('SELECT * FROM identity.session WHERE subject_id=$1',[guest.subject])).rows;
    await expect(f.agencies.create(guest.request(key),'Other name')).rejects.toThrow('IDEMPOTENCY_CONFLICT');
    await expect(f.agencies.create(guest.request(),'Other name')).rejects.toThrow('CREATION_CONFLICT');
    expect(await journal.head(guest.subject)).toEqual(before);expect((await pool.query('SELECT * FROM identity.session WHERE subject_id=$1',[guest.subject])).rows).toEqual(session);
    await expect(f.agencies.get(guest.cookie,randomUUID())).rejects.toThrow('NOT_FOUND');
  });
  it('refuses wrong legacy token without changing session/J1 and serializes two valid claims and creations',async()=>{
    const f=await fixture(),pending=await f.pending();f.healthy();const guest=await f.enroll(await f.service.issue(f.request(),pending.invitationId));
    const before=await journal.head(guest.subject);
    await expect(f.agencies.claim(guest.request(),{token:randomBytes(32).toString('base64url')})).rejects.toThrow('INVITATION_UNAVAILABLE');
    expect(await journal.head(guest.subject)).toEqual(before);
    const claims=await Promise.all([f.agencies.claim(guest.request(),{}),f.agencies.claim(guest.request(),{})]);expect(claims[0]).toEqual(claims[1]);
    const creations=await Promise.all([f.agencies.create(guest.request(),'Concurrent agency'),f.agencies.create(guest.request(),'Concurrent agency')]);
    expect(creations[0]).toEqual(creations[1]);
    expect((await observer.query('SELECT count(*)::int AS n FROM control.agency WHERE invitation_root_id=$1',[pending.rootId])).rows[0].n).toBe(1);
  });
  it('reissues after claim preserving creation, increments epoch once, closes old sessions and keeps REVOKED terminal',async()=>{
    const f=await fixture(),pending=await f.pending();f.healthy();const first=await f.service.issue(f.request(),pending.invitationId),old=await f.enroll(first);
    await f.agencies.claim(old.request(),{});const created=await f.agencies.create(old.request(),'Retained agency'),key=randomUUID();
    const second=await f.service.issue(f.request(2n,key),pending.invitationId);expect(second.version).toBe('3');
    expect((await journal.head(old.subject))?.epoch).toBe(2n);
    expect(await f.auth.session(old.cookie).then(()=>true,()=>false)).toBe(false);await expect(f.agencies.claim(old.request(),{})).rejects.toThrow();
    const replay=await f.service.issue(f.request(0n,key),pending.invitationId);expect(replay).toEqual({invitationId:pending.invitationId,status:'ISSUED',version:'3'});
    expect((await journal.head(old.subject))?.epoch).toBe(2n);
    const current=await f.enroll(second);await f.agencies.claim(current.request(),{});expect(await f.agencies.create(current.request(),'Retained agency')).toEqual(created);
    const revokeKey=randomUUID(),revoked=await f.service.revoke(f.request(3n,revokeKey),pending.invitationId);
    expect(revoked).toEqual({invitationId:pending.invitationId,status:'REVOKED',version:'4'});
    expect((await journal.head(old.subject))?.epoch).toBe(3n);
    expect(await f.auth.session(current.cookie).then(()=>true,()=>false)).toBe(false);
    expect(await f.service.revoke(f.request(0n,revokeKey),pending.invitationId)).toEqual(revoked);
    expect(await f.service.issue(f.request(0n,key),pending.invitationId)).toEqual(revoked);
    const before=await f.snapshot(old.subject);
    await expect(f.service.issue(f.request(4n),pending.invitationId)).rejects.toThrow('VERSION_CONFLICT');
    await expect(f.service.revoke(f.request(4n),pending.invitationId)).rejects.toThrow('VERSION_CONFLICT');
    expect(await f.snapshot(old.subject)).toEqual(before);
    expect((await observer.query('SELECT state FROM control.agency WHERE id=$1',[created.agencyId])).rows[0].state).toBe('PROVISIONING');
  });

  it('rolls back the complete agency/membership/operation/idempotency transaction on outbox SQL failure and keeps J1 closed',async()=>{
    const f=await fixture(),pending=await f.pending();f.healthy();const guest=await f.enroll(await f.service.issue(f.request(),pending.invitationId));
    await f.agencies.claim(guest.request(),{});const key=randomUUID();f.failSql('INSERT INTO control.outbox');
    await expect(f.agencies.create(guest.request(key),'Failed atomic agency')).rejects.toMatchObject({code:'22012'});
    expect((await observer.query('SELECT count(*)::int AS n FROM control.agency WHERE invitation_root_id=$1',[pending.rootId])).rows[0].n).toBe(0);
    expect((await observer.query("SELECT count(*)::int AS n FROM control.idempotency_record WHERE actor_id=$1 AND operation_type='t05.agency-create.v1' AND key=$2",[guest.subject,key])).rows[0].n).toBe(0);
    expect((await observer.query("SELECT count(*)::int AS n FROM control.audit_event WHERE resource_id=$1 AND event_type='agency.creation-accepted'",[pending.rootId])).rows[0].n).toBe(0);
    expect(await f.auth.session(guest.cookie).then(()=>true,()=>false)).toBe(false);
  });
  it('rolls back BFF and receipt together on receipt insertion failure after actual enrollment confirmation J1',async()=>{
    const f=await fixture(),pending=await f.pending();f.healthy();const issued=await f.service.issue(f.request(),pending.invitationId);
    f.failSql('identity.onboarding-receipt.v1');await expect(f.enroll(issued)).rejects.toMatchObject({code:'22012'});
    expect((await pool.query('SELECT count(*)::int AS n FROM identity.session WHERE subject_id=$1',[pending.subjectId])).rows[0].n).toBe(0);
    expect((await observer.query("SELECT count(*)::int AS n FROM control.idempotency_record WHERE actor_id=$1 AND operation_type='identity.onboarding-receipt.v1'",[pending.subjectId])).rows[0].n).toBe(0);
    expect((await journal.head(pending.subjectId))?.state).toBe('CONFIRMED');
    expect((await pool.query('SELECT status FROM identity.account_authority WHERE subject_id=$1',[pending.subjectId])).rows[0].status).toBe('PENDING');
  });
  it('does not treat actual SQL connection loss in native preparation as a healthy-PG uncertain acceptance',async()=>{
    const f=await fixture(),pending=await f.pending();f.healthy();
    // The first SELECT 1 belongs to preparation lease verification, after refresh.
    f.failSql('SELECT 1','connection');
    await expect(f.service.issue(f.request(),pending.invitationId)).rejects.toThrow();
    expect((await observer.query('SELECT status,identity_status FROM control.agency_invitation WHERE id=$1',[pending.invitationId])).rows[0]).toEqual({status:'PENDING_IDENTITY',identity_status:'PENDING'});
    expect((await observer.query("SELECT count(*)::int AS n FROM control.idempotency_record WHERE actor_id=$1 AND operation_type='t05.issue-command.v1'",[f.owner])).rows[0].n).toBe(0);
    expect(await f.auth.session(f.cookie).then(()=>true,()=>false)).toBe(false);
  });

  it('does not upgrade old T04 sessions without receipt or accept receipts copied from another cookie/version/epoch',async()=>{
    const f=await fixture(),pending=await f.pending();f.healthy();const guest=await f.enroll(await f.service.issue(f.request(),pending.invitationId));
    const original=(await observer.query("SELECT result FROM control.idempotency_record WHERE actor_id=$1 AND operation_type='identity.onboarding-receipt.v1'",[guest.subject])).rows[0].result;
    for(const mismatch of ['missing','cookie','version','epoch','tokenHash','admissionReceipt']){
      const session=await f.legacy(guest.subject,guest.root);
      if(mismatch!=='missing'){
        const issuedAt=(await pool.query('SELECT issued_at FROM identity.session WHERE cookie_hash=$1',[session.hash])).rows[0].issued_at.toISOString();
        const receipt={...original,cookieHash:mismatch==='cookie'?original.cookieHash:session.hash,issuedAt};
        if(mismatch==='version')receipt.version='999';if(mismatch==='epoch')receipt.epoch='999';
        if(mismatch==='tokenHash')receipt.tokenHash='0'.repeat(64);if(mismatch==='admissionReceipt')receipt.admissionReceipt=randomUUID();
        await observer.query("INSERT INTO control.idempotency_record(actor_id,operation_type,key,canonical_body_hash,resource_id,result) VALUES($1,'identity.onboarding-receipt.v1',$2,$3,$4,$5)",[guest.subject,onboardingReceiptKey(session.hash),t05Hash(JSON.stringify(receipt)),guest.root,receipt]);
      }
      const before=await journal.head(guest.subject);
      await expect(f.agencies.claim(session.request(),{})).rejects.toThrow('INVITATION_UNAVAILABLE');
      expect(await journal.head(guest.subject)).toEqual(before);expect((await f.auth.session(session.cookie)).scope).toBe('onboarding');
    }
    expect((await observer.query('SELECT status FROM control.agency_invitation WHERE root_id=$1',[guest.root])).rows[0].status).toBe('ISSUED');
    expect(await f.agencies.claim(guest.request(),{})).toEqual({invitationId:pending.invitationId,status:'CLAIMED'});
  });

  it('keeps a reissue command durable after guest fsync crash, leaves SQL unissued and closes old BFF despite rolled back revocation',async()=>{
    const f=await fixture(),pending=await f.pending();f.healthy();const guest=await f.enroll(await f.service.issue(f.request(),pending.invitationId));
    await f.agencies.claim(guest.request(),{});const key=randomUUID();f.crashAfterPending(guest.subject);
    await expect(f.service.issue(f.request(2n,key),pending.invitationId)).rejects.toThrow('SYNTHETIC_CRASH_AFTER_GRANT_FSYNC');
    const command=(await observer.query("SELECT result FROM control.idempotency_record WHERE actor_id=$1 AND operation_type='t05.issue-command.v1' AND key=$2",[f.owner,key])).rows[0].result;
    expect(command.epoch).toBe('2');expect(command.sourceVersion).toBe('2');
    const head=await journal.head(guest.subject);expect(head?.epoch).toBe(2n);expect(head?.state).toBe('PENDING');expect(head?.commandId).toBe(command.commandId);
    expect((await observer.query('SELECT status,version FROM control.agency_invitation WHERE id=$1',[pending.invitationId])).rows[0]).toEqual({status:'CLAIMED',version:'2'});
    expect((await observer.query("SELECT count(*)::int AS n FROM control.idempotency_record WHERE actor_id=$1 AND operation_type='t05.issue-complete.v1' AND key=$2",[f.owner,key])).rows[0].n).toBe(0);
    expect(await f.auth.session(guest.cookie).then(()=>true,()=>false)).toBe(false);
  });

  it('serializes creation from two receipt-bound BFF sessions and keeps the conflict loser usable',async()=>{
    const f=await fixture(),pending=await f.pending();f.healthy();const first=await f.enroll(await f.service.issue(f.request(),pending.invitationId));
    await f.agencies.claim(first.request(),{});const second=await f.legacy(first.subject,first.root,true),key=randomUUID();
    const same=await Promise.all([f.agencies.create(first.request(key),'Two sessions'),f.agencies.create({...second.request(),key},'Two sessions')]);
    expect(same[0]).toEqual(same[1]);
    const different=await Promise.allSettled([f.agencies.create(first.request(),'Other one'),f.agencies.create(second.request(),'Other two')]);
    expect(different.every(result=>result.status==='rejected'&&result.reason.message==='CREATION_CONFLICT')).toBe(true);
    expect((await f.auth.session(first.cookie)).scope).toBe('onboarding');expect((await f.auth.session(second.cookie)).scope).toBe('onboarding');
  });
  it.each(['issue','revoke'] as const)('serializes real claim against owner %s without stale authorization or a second root',async action=>{
    const f=await fixture(),pending=await f.pending();f.healthy();const guest=await f.enroll(await f.service.issue(f.request(),pending.invitationId));
    const result=await Promise.allSettled([f.agencies.claim(guest.request(),{}),action==='issue'?f.service.issue(f.request(2n),pending.invitationId):f.service.revoke(f.request(2n),pending.invitationId)]);
    expect(result[1].status).toBe('fulfilled');
    const row=(await observer.query('SELECT status,version FROM control.agency_invitation WHERE id=$1',[pending.invitationId])).rows[0];expect(row).toEqual({status:action==='issue'?'ISSUED':'REVOKED',version:'3'});
    expect(await f.auth.session(guest.cookie).then(()=>true,()=>false)).toBe(false);
    expect((await journal.head(guest.subject))?.epoch).toBe(2n);
    expect((await observer.query('SELECT count(*)::int AS n FROM control.agency WHERE invitation_root_id=$1',[pending.rootId])).rows[0].n).toBe(0);
  });

  it('recovers cleanly from a lost creation response with a new stateless service and the same durable operation',async()=>{
    const f=await fixture(),pending=await f.pending();f.healthy();const guest=await f.enroll(await f.service.issue(f.request(),pending.invitationId));
    await f.agencies.claim(guest.request(),{});const key=randomUUID();await f.agencies.create(guest.request(key),'Response lost').then(()=>undefined);
    const restarted=new AgenciesService({auth:f.auth}),current=await restarted.get(guest.cookie);
    expect(current?.state).toBe('PROVISIONING');expect(await restarted.create(guest.request(key),'Response lost')).toEqual(current);
    expect((await observer.query('SELECT count(*)::int AS n FROM control.provisioning_operation o JOIN control.agency a ON a.id=o.agency_id WHERE a.invitation_root_id=$1',[pending.rootId])).rows[0].n).toBe(1);
  });
  it('refuses an expired first claim before refresh/J1 and never creates an agency from that admission',async()=>{
    const f=await fixture(),pending=await f.pending();f.healthy();const guest=await f.enroll(await f.service.issue(f.request(),pending.invitationId));
    await observer.query("UPDATE control.agency_invitation SET expires_at=now()-interval '1second' WHERE id=$1",[pending.invitationId]);
    const before=await journal.head(guest.subject);
    await expect(f.agencies.claim(guest.request(),{})).rejects.toThrow('INVITATION_UNAVAILABLE');
    expect(await journal.head(guest.subject)).toEqual(before);
    expect((await observer.query('SELECT count(*)::int AS n FROM control.agency WHERE invitation_root_id=$1',[pending.rootId])).rows[0].n).toBe(0);
  });

  it('recovers the same reserved IDs after TXA committed but the process stopped before TXB, including a new key for the same proof',async()=>{
    const f=await fixture(),{signed,refs}=await f.confirmation(),key=randomUUID();f.interruptBeforePreparation();
    await expect(f.service.create(f.request(1n,key),refs)).rejects.toThrow('SYNTHETIC_BETWEEN_TRANSACTIONS');
    expect(f.calls.create).toBe(0);expect(f.calls.user).toBe(0);
    expect((await observer.query('SELECT subject_id,root_id,status,identity_status FROM control.agency_invitation WHERE id=$1',[signed.invitationId])).rows[0]).toEqual({subject_id:signed.subjectId,root_id:signed.rootId,status:'PENDING_IDENTITY',identity_status:'PENDING'});
    expect((await pool.query('SELECT count(*)::int AS n FROM identity.account_authority WHERE subject_id=$1',[signed.subjectId])).rows[0].n).toBe(0);
    f.healthy();const accepted=await f.service.create(f.request(1n,key),refs);
    expect(accepted).toEqual({invitationId:signed.invitationId,status:'PENDING_IDENTITY'});
    expect(await f.service.create(f.request(),refs)).toEqual(accepted);expect(f.calls.create).toBe(1);
    expect((await observer.query('SELECT count(*)::int AS n FROM control.agency_invitation WHERE root_id=$1',[signed.rootId])).rows[0].n).toBe(1);
  });

});
