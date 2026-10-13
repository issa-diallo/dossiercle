import { Pool } from 'pg';
import { readFile } from 'node:fs/promises';
import { randomBytes,randomUUID,createHash } from 'node:crypto';
import { UUID } from '@dossiercle/contracts';
import { AuthorityJournal } from '../src/journal/authority-journal.js';

/** Explicit private synthetic issuer fixture. Keeps native factors/consumption,
 * J1 history and root; advances the epoch/version, never restores a snapshot.
 * This is not a public invitation endpoint or an implementation of T05. */
export async function reissueSyntheticEnrollment(input:{subject:string;root:string}){
 UUID.parse(input.subject);UUID.parse(input.root);
 const e=JSON.parse(await readFile('.local/environment.json','utf8')) as {root:string;private:string;pgPort:number;syntheticOnly:boolean};
 if(!e.syntheticOnly||e.root!==process.cwd())throw new Error('SYNTHETIC_REQUIRED');
 const pool=new Pool({host:'127.0.0.1',port:e.pgPort,database:'control',user:'control_migrator',password:(await readFile(e.private+'/pg/control_migrator','utf8')).trim(),max:1});
 const journal=new AuthorityJournal('.local/journal/application'),client=await pool.connect();
 const token=randomBytes(32).toString('base64url');
 try{
  await client.query('BEGIN');
  const invitation=(await client.query('SELECT * FROM control.agency_invitation WHERE root_id=$1 FOR UPDATE',[input.root])).rows[0];
  if(!invitation||invitation.subject_id!==input.subject||!String(invitation.contact).endsWith('@example.invalid')||invitation.status!=='ISSUED'||invitation.identity_status!=='CONFIRMED')throw new Error('SYNTHETIC_INVITATION_REQUIRED');
  const authority=(await client.query('SELECT * FROM identity.account_authority WHERE subject_id=$1 FOR UPDATE',[input.subject])).rows[0];
  const previous=await journal.head(input.subject);
  if(!authority||authority.status!=='CONFIRMED'||previous?.state!=='CONFIRMED'||previous.hash!==authority.journal_hash||previous.epoch!==BigInt(authority.identity_epoch))throw new Error('SYNTHETIC_AUTHORITY_REQUIRED');
  const epoch=previous.epoch+1n;
  const head=await journal.append(client,{subjectId:input.subject,epoch,commandId:randomUUID(),state:'PENDING',actor:{id:invitation.owner_id,type:'human'}});
  await client.query("UPDATE identity.account_authority SET identity_epoch=$2,confirmed_epoch=NULL,status='PENDING',enrollment_status='PENDING',recovery_ready=false,journal_sequence=$3,journal_hash=$4 WHERE subject_id=$1",[input.subject,epoch.toString(),head.sequence.toString(),head.hash]);
  await client.query('UPDATE identity.session SET revoked_at=now() WHERE subject_id=$1 AND revoked_at IS NULL',[input.subject]);
  await client.query("UPDATE control.agency_invitation SET token_hash=$2,version=version+1,expires_at=now()+interval '10 minutes' WHERE root_id=$1",[input.root,createHash('sha256').update(token).digest('hex')]);
  await client.query('COMMIT');return token;
 }catch{await client.query('ROLLBACK');throw new Error('SYNTHETIC_REISSUE_CLOSED');}
 finally{client.release();await pool.end();}
}
