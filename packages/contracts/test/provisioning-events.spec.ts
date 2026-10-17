import {describe,it,expect} from 'vitest';
import {parseProvisioningEvent} from '../src/provisioning.events.js';
const event={schemaVersion:1,agencyId:'11111111-1111-4111-8111-111111111111',resourceId:'22222222-2222-4222-8222-222222222222',version:'1'};
describe('T06 event contracts',()=>{
 it('accepts the two exact central event shapes',()=>{
  expect(parseProvisioningEvent('agency.creation-accepted',event).name).toBe('agency.creation-accepted');
  expect(parseProvisioningEvent('agency.provisioning-wakeup',{...event,expectedOperationVersion:'2',targetAttempt:1,deliveryRound:1}).name).toBe('agency.provisioning-wakeup');
 });
 it('rejects unknown names, additional fields, old versions and unbounded rounds',()=>{
  expect(()=>parseProvisioningEvent('agency.other',event)).toThrow();
  expect(()=>parseProvisioningEvent('agency.creation-accepted',{...event,secret:'never'})).toThrow();
  expect(()=>parseProvisioningEvent('agency.provisioning-wakeup',{...event,expectedOperationVersion:'2',targetAttempt:5,deliveryRound:1})).toThrow();
  expect(()=>parseProvisioningEvent('agency.provisioning-wakeup',{...event,expectedOperationVersion:'2',targetAttempt:1,deliveryRound:4})).toThrow();
 });
});
