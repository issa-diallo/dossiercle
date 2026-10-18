import type { AuthService } from '../auth/auth.service.js';
import type { T05LockPlan, T05Target } from '../auth/t05-locks.js';
import { invitationById } from '@dossiercle/adapters/postgres/t05.repository';
export interface T05CommandRequest {cookie:string|undefined;origin:string|undefined;csrf:string|undefined;key:string;version?:bigint}
export const mutation=(request:T05CommandRequest)=>({origin:request.origin,csrf:request.csrf,humanActivity:true as const});
export function ownerInvitationPlan<Decision=void>(id:string,authority:T05Target['authority']='existing'):T05LockPlan<Decision>{
  return {mode:'owner',resolve:async client=>{
    const row=await invitationById(client,id);
    return row?[{rootId:row.root_id,subjectId:row.subject_id,authority,invitation:'existing'}]:[];
  }};
}
export type PrivateAuth=Pick<AuthService,'withT05Session'|'withT07Session'|'revalidateT07'>;
