import { parseActivationEvent } from '@dossiercle/contracts/activation-events';

/** Separate signed Inngest handler; it trusts only the event ID after validating its strict envelope. */
export function activationProjection(project:(eventId:string)=>Promise<void>){
  return async(event:{id?:string|null;name:string;data:unknown})=>{
    parseActivationEvent(event.name,event.data);
    if(typeof event.id!=='string')throw new Error('ACTIVATION_EVENT_REFUSED');
    return await project(event.id);
  };
}
