import { Pool } from 'pg';
export { Pool };
export type { PoolClient } from 'pg';
export function controlPool(options: { host: string; port: number; password: string; role: 'control_api' | 'control_coordinator' | 'control_dispatcher' | 'provisioner'; max: number }) {
  const limit=options.role==='provisioner'?4:2;
  if (!Number.isInteger(options.max) || options.max < 1 || options.max > limit) throw new Error('INVALID_CONTROL_POOL_LIMIT');
  return new Pool({host:options.host,port:options.port,database:'control',user:options.role,password:options.password,max:options.max,
    connectionTimeoutMillis:5000,idleTimeoutMillis:30000,statement_timeout:10000,query_timeout:15000});
}
