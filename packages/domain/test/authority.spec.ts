import { describe,expect,it } from 'vitest';
import { requireAuthority,type AuthorityHead,type AuthorityProjection } from '../src/authority.js';
const p:AuthorityProjection={subjectId:'opaque',identityEpoch:1n,confirmedEpoch:1n,status:'CONFIRMED',journalSequence:2n,journalHash:'a'.repeat(64),enrollmentStatus:'VERIFIED',recoveryReady:true};
const h:AuthorityHead={subjectId:'opaque',epoch:1n,sequence:2n,hash:'a'.repeat(64),state:'CONFIRMED'};
describe('authority requires current journal and native evidence',()=>{
 it('accepts matching confirmed authority only',()=>expect(()=>requireAuthority(p,h)).not.toThrow());
 for(const key of ['status','enrollmentStatus','recoveryReady','confirmedEpoch'] as const) it(`denies incomplete ${key}`,()=>expect(()=>requireAuthority({...p,[key]:key==='recoveryReady'?false:key==='confirmedEpoch'?null:'PENDING'},h)).toThrow());
 for(const field of ['subjectId','epoch','sequence','hash','state'] as const) it(`denies divergent journal ${field}`,()=>expect(()=>requireAuthority(p,{...h,[field]:field==='epoch'||field==='sequence'?99n:field==='state'?'PENDING':'foreign'})).toThrow());
 it('denies absent journal',()=>expect(()=>requireAuthority(p,null)).toThrow('AUTHORITY_UNAVAILABLE'));
});
