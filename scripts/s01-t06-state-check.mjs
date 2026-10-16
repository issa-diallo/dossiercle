import { fixturePool, inspectPartition } from './s01-fixture-manifests.mjs';
const pool = await fixturePool();
try {
    const fixtures = await inspectPartition(pool, true);
    const ids = fixtures.t06.map(t => t.agencyId);
    const rows = (await pool.query(`SELECT a.id,a.state,a.activated_at,o.step,o.status,o.retryable,
  l.schema_version,l.secret_version,l.verification_version::text,m.role,m.state AS membership
  FROM control.agency a JOIN control.provisioning_operation o ON o.agency_id=a.id
  JOIN identity.membership m ON m.agency_id=a.id
  LEFT JOIN control.database_locator l ON l.agency_id=a.id WHERE a.id=ANY($1::uuid[])`, [ids])).rows;
    if (rows.length !== ids.length || rows.some(r => r.activated_at !== null || r.role !== 'ADMIN' || r.membership !== 'PENDING'
        || r.state === 'ACTIVE' || !['PROVISIONING', 'READY', 'FAILED'].includes(r.state)))
        throw new Error('T06_NOT_CLOSED');
    const ready = rows.filter(r => r.state === 'READY');
    if (!ready.length || ready.some(r => r.step !== 'READY' || r.status !== 'SUCCEEDED' || r.schema_version !== 1
        || !r.secret_version || BigInt(r.verification_version) < 1n))
        throw new Error('T06_READY_UNVERIFIED');
    console.log(JSON.stringify({ syntheticOnly: true, t06: rows.length, ready: ready.length,
        failed: rows.filter(r => r.state === 'FAILED').length, pending: rows.filter(r => r.state === 'PROVISIONING').length,
        active: 0, adminActive: 0, exhaustive: true, disjoint: true }));
}
finally {
    await pool.end();
}
