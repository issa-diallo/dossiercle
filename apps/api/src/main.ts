import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { startCoordinator, type Configuration } from './identity/coordinator.server.js';

/** The API runs only inside the isolated synthetic TLS coordinator environment. */
export async function bootstrap() {
  const config=JSON.parse(readFileSync('/run/s01-coordinator-config/config.json','utf8')) as Configuration;
  return await startCoordinator(config);
}
if(import.meta.url===`file://${process.argv[1]}`){
  try{await bootstrap();}catch{process.stderr.write('IDENTITY_COORDINATOR_CLOSED\n');process.exitCode=1;}
}
