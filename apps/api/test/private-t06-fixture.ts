import { readFile } from 'node:fs/promises';
import { randomUUID, createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { Pool } from '@dossiercle/adapters/postgres/runtime-pool';
import { AuthorityJournal } from '@dossiercle/adapters/journal/authority-journal';
export async function t06Environment() {
    const e = JSON.parse(await readFile('.local/environment.json', 'utf8')) as {
        root: string;
        private: string;
        project: string;
        pgPort: number;
        syntheticOnly: boolean;
    };
    if (!e.syntheticOnly || e.root !== process.cwd())
        throw new Error('SYNTHETIC_REQUIRED');
    return e;
}
export async function t06Pool(role: string, database = 'control', max = 1) {
    const e = await t06Environment();
    return new Pool({ host: '127.0.0.1', port: e.pgPort, database, user: role,
        password: (await readFile(e.private + '/pg/' + role, 'utf8')).trim(), max });
}
/** A private host fixture, with explicit central creation provenance; never an API bypass. */
export async function createT06Fixture(delivered = false) {
    const tuple = { rootId: randomUUID(), subjectId: randomUUID(), agencyId: randomUUID(), operationId: randomUUID() };
    const eventId = randomUUID(), owner = randomUUID(), commandId = randomUUID();
    // A crash after COMMIT cannot turn this T06 command into a default T05 fixture.
    execFileSync(process.execPath, ['scripts/s01-fixture-manifests.mjs', 'declare', JSON.stringify(tuple)], { stdio: 'pipe' });
    const pool = await t06Pool('control_migrator'), client = await pool.connect();
    const journal = new AuthorityJournal('.local/journal/application');
    try {
        await client.query('BEGIN');
        await client.query('INSERT INTO identity.account_authority(subject_id) VALUES($1)', [tuple.subjectId]);
        await client.query('SELECT 1 FROM identity.account_authority WHERE subject_id=$1 FOR UPDATE', [tuple.subjectId]);
        await journal.append(client, { subjectId: tuple.subjectId, commandId, epoch: 1n, state: 'PENDING' });
        const head = await journal.append(client, { subjectId: tuple.subjectId, commandId, epoch: 1n, state: 'CONFIRMED' });
        await client.query(`UPDATE identity.account_authority SET status='CONFIRMED',confirmed_epoch=1,
   journal_sequence=$2,journal_hash=$3,enrollment_status='VERIFIED',recovery_ready=true
   WHERE subject_id=$1`, [tuple.subjectId, head.sequence.toString(), head.hash]);
        await client.query(`INSERT INTO control.agency_invitation(id,root_id,subject_id,contact,owner_id,
   identity_status,status) VALUES($1,$2,$3,$4,$5,'CONFIRMED','CLAIMED')`, [randomUUID(), tuple.rootId, tuple.subjectId, tuple.subjectId + '@example.invalid', owner]);
        await client.query(`INSERT INTO control.agency(id,invitation_root_id,name,canonical_name_hash)
   VALUES($1,$2,'T06 synthetic',$3)`, [tuple.agencyId, tuple.rootId, createHash('sha256').update(tuple.agencyId).digest('hex')]);
        await client.query("INSERT INTO identity.membership(subject_id,agency_id,role) VALUES($1,$2,'ADMIN')", [tuple.subjectId, tuple.agencyId]);
        await client.query('INSERT INTO control.provisioning_operation(id,agency_id) VALUES($1,$2)', [tuple.operationId, tuple.agencyId]);
        await client.query(`INSERT INTO control.idempotency_record(actor_id,operation_type,key,
   canonical_body_hash,resource_id,result) VALUES($1,'t05.agency-create.v1',$2,$3,$4,$5)`, [tuple.subjectId, randomUUID(), '0'.repeat(64), tuple.rootId,
            JSON.stringify({ agencyId: tuple.agencyId, operationId: tuple.operationId })]);
        await client.query(`INSERT INTO control.audit_event(event_id,agency_id,actor_id,actor_type,event_type,
   resource_id,outcome,correlation,resource_version) VALUES($1,$2,$3,'human','agency.creation-accepted',$4,'accepted',$5,1)`, [eventId, tuple.agencyId, tuple.subjectId, tuple.rootId, randomUUID()]);
        await client.query(`INSERT INTO control.outbox(event_id,type,agency_id,resource_id,version)
   VALUES($1,'agency.creation-accepted',$2,$3,1)`, [eventId, tuple.agencyId, tuple.rootId]);
        if (delivered)
            await client.query("UPDATE control.outbox SET status='DELIVERED' WHERE event_id=$1", [eventId]);
        await client.query('COMMIT');
    }
    catch (error) {
        await client.query('ROLLBACK');
        throw error;
    }
    finally {
        client.release();
        await pool.end();
    }
    execFileSync(process.execPath, ['scripts/s01-fixture-manifests.mjs', 'register', JSON.stringify(tuple)], { stdio: 'pipe' });
    return { ...tuple, eventId };
}
