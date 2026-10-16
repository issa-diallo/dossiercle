import {describe,it,expect} from 'vitest';
import {beginProvisioning,confirmProvisioningStep,classifyProvisioningFailure,failProvisioning,type ProvisioningState} from '../src/provisioning.js';
describe('T06 provisioning transitions',()=>{
  it('advances only confirmed steps and caps the initial attempt plus three retries',()=>{
    let state:ProvisioningState={step:'ACCEPTED',status:'PENDING',attempt:0,version:1n,retryable:false};
    state=beginProvisioning(state);
    expect(()=>confirmProvisioningStep(state,'SCHEMA_READY')).toThrow('PROVISIONING_STEP_DIVERGED');
    state=failProvisioning(state,'SAFE_RETRY');
    for(let i=0;i<3;i++){state=beginProvisioning(state);state=failProvisioning(state,'SAFE_RETRY');}
    expect(state.retryable).toBe(false);
    expect(()=>beginProvisioning(state)).toThrow('PROVISIONING_NOT_RETRYABLE');
  });
  it('keeps uncertain effects closed and only retries after confirmed closure',()=>{
    expect(classifyProvisioningFailure({effectStarted:true,effectConfirmed:false,closed:true})).toBe('UNCERTAIN');
    expect(classifyProvisioningFailure({effectStarted:true,effectConfirmed:true,closed:true})).toBe('SAFE_RETRY');
    expect(classifyProvisioningFailure({effectStarted:false,effectConfirmed:false,closed:true,terminal:true})).toBe('TERMINAL');
  });
});
