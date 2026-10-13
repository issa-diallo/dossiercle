import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { open, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { PoolClient } from 'pg';
import type { AuthorityHead } from '@dossiercle/domain/authority';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
interface Entry { version:1|2; actorId?:string; actorType?:'human'|'service'; at?:string; subjectId:string; commandId:string; epoch:string; sequence:string; state:AuthorityHead['state']; previousHash:string; hash:string }
const hash=(value: Omit<Entry,'hash'>) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
/** Local synthetic J1. NOT a production ObjectLock/IAM qualification. */
export class AuthorityJournal {
  readonly path: string;
  constructor(directory: string) { this.path=resolve(directory,'authority.jsonl'); }
  async initializeSynthetic(): Promise<void> {
    await mkdir(resolve(this.path,'..'),{recursive:true,mode:0o700});
    const marker=resolve(this.path,'..','initialized');let initialized=false;
    try {
      const file=await open(marker,constants.O_RDONLY|constants.O_NOFOLLOW);
      try{if(await file.readFile('utf8')!=='S01_SYNTHETIC_JOURNAL_INITIALIZED\n')throw new Error('INVALID_MARKER');initialized=true;}finally{await file.close();}
    }catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw new Error('JOURNAL_UNAVAILABLE');}
    if(initialized){await this.entries();return;}
    try { const file=await open(this.path,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);await file.sync();await file.close(); const directory=await open(resolve(this.path,'..'),constants.O_RDONLY);await directory.sync();await directory.close(); }
    catch (error) { if ((error as NodeJS.ErrnoException).code!=='EEXIST') throw new Error('JOURNAL_UNAVAILABLE'); await this.entries(); }
    try {
      const file=await open(marker,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);
      try{await file.writeFile('S01_SYNTHETIC_JOURNAL_INITIALIZED\n');await file.sync();}finally{await file.close();}
      const directory=await open(resolve(this.path,'..'),constants.O_RDONLY);try{await directory.sync();}finally{await directory.close();}
    }catch(error){if((error as NodeJS.ErrnoException).code!=='EEXIST')throw new Error('JOURNAL_UNAVAILABLE');}
  }
  private async entries(): Promise<Entry[]> {
    try {
      const file=await open(this.path,constants.O_RDONLY|constants.O_NOFOLLOW); let contents:string;
      try { contents=await file.readFile('utf8'); } finally {await file.close();}
      if (contents && !contents.endsWith('\n')) throw new Error('TRUNCATED');
      const rows=contents?contents.slice(0,-1).split('\n').map(line => JSON.parse(line) as Entry):[];
      let previous='0'.repeat(64);let sequence=0n;
      for (const row of rows) {
        const { hash:actual,...body }=row;
        if (!((row.version===1 && Object.keys(row).length===8) || (row.version===2 && Object.keys(row).length===11 && uuid.test(row.actorId??'') && ['human','service'].includes(row.actorType??'') && /^\d{4}-\d{2}-\d{2}T/.test(row.at??'') && Number.isFinite(Date.parse(row.at??'')))) || !uuid.test(row.subjectId) || !uuid.test(row.commandId) || !/^[1-9][0-9]*$/.test(row.epoch) || BigInt(row.sequence)!==++sequence || row.previousHash!==previous || !['PENDING','DENIED','CONFIRMED'].includes(row.state) || actual!==hash(body)) throw new Error('DIVERGED');
        previous=actual;
      }
      return rows;
    } catch { throw new Error('JOURNAL_UNAVAILABLE'); }
  }
  async head(subjectId:string): Promise<(AuthorityHead & {commandId:string})|null> {
    const row=(await this.entries()).findLast(entry => entry.subjectId===subjectId);
    return row?{commandId:row.commandId,subjectId:row.subjectId,epoch:BigInt(row.epoch),sequence:BigInt(row.sequence),hash:row.hash,state:row.state}:null;
  }
  /** Coordinator only; PostgreSQL global lock serializes every writer, including restarts. */
  async append(client:PoolClient, input:{subjectId:string;commandId:string;epoch:bigint;state:AuthorityHead['state'];actor?:{id:string;type:'human'|'service'}}): Promise<AuthorityHead> {
    if (!uuid.test(input.subjectId) || !uuid.test(input.commandId) || input.epoch<1n) throw new Error('JOURNAL_INVALID');
    // The caller holds the subject authority row until SQL convergence/commit.
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended('s01.journal.writer',0))");
    const lock=await client.query("WITH k AS (SELECT hashtextextended('s01.journal.writer',0) AS v) SELECT count(*)::int AS n FROM pg_locks,k WHERE pid=pg_backend_pid() AND locktype='advisory' AND mode='ExclusiveLock' AND granted AND classid=((k.v>>32)&4294967295)::oid AND objid=(k.v&4294967295)::oid AND objsubid=1");
    if(lock.rows[0].n<1)throw new Error('JOURNAL_TRANSACTION_REQUIRED');
    const rows=await this.entries();
    const replay=rows.find(row => row.commandId===input.commandId && row.state===input.state);
    if (replay) {
      if (replay.subjectId!==input.subjectId || replay.epoch!==input.epoch.toString()) throw new Error('JOURNAL_COMMAND_CONFLICT');
      const current=await this.head(input.subjectId); if (!current || current.sequence!==BigInt(replay.sequence)) throw new Error('JOURNAL_STALE_COMMAND');return current;
    }
    const previousSubject=rows.findLast(row=>row.subjectId===input.subjectId);
    if (previousSubject && input.epoch<BigInt(previousSubject.epoch)) throw new Error('JOURNAL_EPOCH_REGRESSION');
    if (input.state==='CONFIRMED' && (!previousSubject || previousSubject.state!=='PENDING' || previousSubject.commandId!==input.commandId || previousSubject.epoch!==input.epoch.toString())) throw new Error('JOURNAL_CONFIRM_WITHOUT_PENDING');
    const actor=input.actor??{id:'00000000-0000-4000-8000-000000000030',type:'service' as const};
    if(!uuid.test(actor.id))throw new Error('JOURNAL_INVALID_ACTOR');
    const body:Omit<Entry,'hash'>={version:2,actorId:actor.id,actorType:actor.type,at:new Date().toISOString(),subjectId:input.subjectId,commandId:input.commandId,epoch:input.epoch.toString(),sequence:(BigInt(rows.length)+1n).toString(),state:input.state,previousHash:rows.at(-1)?.hash??'0'.repeat(64)};
    const row={...body,hash:hash(body)};
    const file=await open(this.path,constants.O_WRONLY|constants.O_APPEND|constants.O_NOFOLLOW);
    try { await file.writeFile(JSON.stringify(row)+'\n');await file.sync(); } finally {await file.close();}
    // Losing the DB lock/connection closes convergence and any subsequent grant.
    await client.query('SELECT 1');
    return {subjectId:row.subjectId,epoch:input.epoch,sequence:BigInt(row.sequence),hash:row.hash,state:row.state};
  }
}
