import type { Pool } from 'pg';
import type { Inngest } from 'inngest';
export class OutboxDispatcher {
  constructor(private readonly pool:Pool,private readonly inngest:Pick<Inngest,'send'>,private readonly allowedAgencies?:()=>Promise<readonly string[]>) {}
  async dispatchOne(afterPublish?:()=>Promise<void>):Promise<boolean> {
    const client=await this.pool.connect();
    try {
      await client.query('BEGIN');
      const allowed=this.allowedAgencies?await this.allowedAgencies():null;
      const row=(await client.query<{event_id:string;type:string;schema_version:number;agency_id:string|null;resource_id:string;version:string}>("SELECT event_id,type,schema_version,agency_id,resource_id,version::text FROM control.outbox WHERE status='PENDING' AND ($1::uuid[] IS NULL OR agency_id=ANY($1::uuid[])) ORDER BY event_id LIMIT 1 FOR UPDATE SKIP LOCKED",[allowed])).rows[0];
      if(!row){await client.query('COMMIT');return false;}
      // Stable logical id survives publish→SQL-ack crashes. Inngest may retain duplicate receipts;
      // the T06 handler deduplicates effects from current operation/version. No locator/credential in payload.
      const data:Record<string,unknown>={schemaVersion:row.schema_version,agencyId:row.agency_id,resourceId:row.resource_id,version:row.version};
      if(row.type==='agency.provisioning-wakeup'){
        const wake=(await client.query('SELECT expected_operation_version::text,target_attempt,delivery_round FROM control.provisioning_wakeup WHERE event_id=$1',[row.event_id])).rows[0];
        if(!wake)throw new Error('OUTBOX_WAKEUP_SOURCE_MISSING');
        Object.assign(data,{expectedOperationVersion:wake.expected_operation_version,targetAttempt:wake.target_attempt,deliveryRound:wake.delivery_round});
      }
      await this.inngest.send({id:row.event_id,name:row.type,data});
      await afterPublish?.();
      await client.query("UPDATE control.outbox SET status='DELIVERED',attempt=attempt+1 WHERE event_id=$1",[row.event_id]);await client.query('COMMIT');return true;
    }catch{await client.query('ROLLBACK');throw new Error('OUTBOX_UNAVAILABLE');}finally{client.release();}
  }
}
