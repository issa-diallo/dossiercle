import type { Pool } from 'pg';
import type { Inngest } from 'inngest';
export class OutboxDispatcher {
  constructor(private readonly pool:Pool,private readonly inngest:Pick<Inngest,'send'>) {}
  async dispatchOne(afterPublish?:()=>Promise<void>):Promise<boolean> {
    const client=await this.pool.connect();
    try {
      await client.query('BEGIN');
      const row=(await client.query<{event_id:string;type:string;schema_version:number;agency_id:string|null;resource_id:string;version:string}>("SELECT event_id,type,schema_version,agency_id,resource_id,version::text FROM control.outbox WHERE status='PENDING' ORDER BY event_id LIMIT 1 FOR UPDATE SKIP LOCKED")).rows[0];
      if(!row){await client.query('COMMIT');return false;}
      // Stable logical id survives publish→SQL-ack crashes. Inngest may retain duplicate receipts;
      // the T06 handler deduplicates effects from current operation/version. No locator/credential in payload.
      await this.inngest.send({id:row.event_id,name:row.type,data:{schemaVersion:row.schema_version,agencyId:row.agency_id,resourceId:row.resource_id,version:row.version}});
      await afterPublish?.();
      await client.query("UPDATE control.outbox SET status='DELIVERED',attempt=attempt+1 WHERE event_id=$1",[row.event_id]);await client.query('COMMIT');return true;
    }catch{await client.query('ROLLBACK');throw new Error('OUTBOX_UNAVAILABLE');}finally{client.release();}
  }
}
