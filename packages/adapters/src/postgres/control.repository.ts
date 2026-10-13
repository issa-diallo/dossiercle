import { writeAudit } from '../audit/audit-writer.js';
import type { Pool, PoolClient } from 'pg';
import { AuthorityClosed, requireAuthority, type AuthorityProjection, type AuthorityHead } from '@dossiercle/domain/authority';
import type { AuthorityJournal } from '../journal/authority-journal.js';
interface AuthorityRow {subject_id:string;identity_epoch:string;confirmed_epoch:string|null;status:string;journal_sequence:string;journal_hash:string|null;enrollment_status:string;recovery_ready:boolean}
export class ControlRepository {
  constructor(private readonly pool:Pool,private readonly journal:AuthorityJournal,private readonly auditRole='control_audit') {}
  async withAuthority<T>(subjectId:string,write:boolean,work:(client:PoolClient,projection:AuthorityProjection)=>Promise<T>):Promise<T> {
    const client=await this.pool.connect();
    try {
      await client.query('BEGIN');
      const value=await this.withLockedAuthority(client,subjectId,write,work);
      await client.query('COMMIT');return value;
    }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  }
  /** Existing transaction only, so callers can acquire invitation before authority. */
  async withLockedAuthority<T>(client:PoolClient,subjectId:string,write:boolean,work:(client:PoolClient,projection:AuthorityProjection)=>Promise<T>):Promise<T> {
      const result=await client.query<AuthorityRow>('SELECT * FROM control.lock_authority($1,$2)',[subjectId,write]);
      // Tuple locking assigns an xid. In autocommit that xid lock is already gone.
      const transaction=await client.query("SELECT EXISTS(SELECT 1 FROM pg_locks WHERE pid=pg_backend_pid() AND locktype='transactionid' AND mode='ExclusiveLock' AND granted) AS held");
      if(transaction.rows[0]?.held!==true)throw new AuthorityClosed('AUTHORITY_UNAVAILABLE');
      const row=result.rows[0];if(!row)throw new AuthorityClosed('AUTHORITY_DENIED');
      const projection={subjectId:row.subject_id,identityEpoch:BigInt(row.identity_epoch),confirmedEpoch:row.confirmed_epoch===null?null:BigInt(row.confirmed_epoch),status:row.status,journalSequence:BigInt(row.journal_sequence),journalHash:row.journal_hash,enrollmentStatus:row.enrollment_status,recoveryReady:row.recovery_ready};
      let head:AuthorityHead|null;try{head=await this.journal.head(subjectId);}catch{throw new AuthorityClosed('AUTHORITY_UNAVAILABLE');}
      requireAuthority(projection,head);
      return await work(client,projection);
  }
  /** Deny/PENDING fsync precedes upstream changes and survives a failed SQL transaction. */
  async deny(subjectId:string,commandId:string,converge:()=>Promise<void>,actor:{id:string;type:'human'|'service'}={id:'00000000-0000-4000-8000-000000000030',type:'service'}):Promise<void> {
    const client=await this.pool.connect();
    try {
      await client.query('BEGIN');
      const row=(await client.query<AuthorityRow>('SELECT * FROM identity.account_authority WHERE subject_id=$1 FOR UPDATE',[subjectId])).rows[0];
      if(!row)throw new AuthorityClosed('AUTHORITY_DENIED');
      const oldHead=await this.journal.head(subjectId);
      const replay=oldHead?.commandId===commandId;
      if (replay && oldHead.state==='DENIED' && row.status==='DENIED' && row.journal_hash===oldHead.hash) {await client.query('COMMIT');return;}
      const epoch=replay?oldHead.epoch:(oldHead && oldHead.epoch>BigInt(row.identity_epoch)?oldHead.epoch:BigInt(row.identity_epoch))+1n;
      if (!replay || oldHead.state==='PENDING') await this.journal.append(client,{subjectId,commandId,epoch,state:'PENDING',actor});
      await converge();
      const head=await this.journal.append(client,{subjectId,commandId,epoch,state:'DENIED',actor});
      await client.query("UPDATE identity.account_authority SET identity_epoch=$2,confirmed_epoch=NULL,status='DENIED',journal_sequence=$3,journal_hash=$4,enrollment_status='DENIED',recovery_ready=false WHERE subject_id=$1",[subjectId,epoch.toString(),head.sequence.toString(),head.hash]);
      await client.query('UPDATE identity.session SET revoked_at=now() WHERE subject_id=$1 AND revoked_at IS NULL',[subjectId]);
      await client.query("UPDATE identity.membership SET state='DENIED',version=version+1 WHERE subject_id=$1 AND state<>'DENIED'",[subjectId]);
      await writeAudit(client,{eventId:commandId,agencyId:null,actorId:actor.id,actorType:actor.type,eventType:'identity.enrollment.denied',resourceId:subjectId,version:epoch,outcome:'denied',correlation:commandId,dispatch:false},this.auditRole);
      await client.query('COMMIT');
    }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  }
}
