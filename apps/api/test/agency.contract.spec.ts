import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import SwaggerParser from '@apidevtools/swagger-parser';
import { describe, expect, it } from 'vitest';
import { ErrorResponse, AgencyAccepted, ActivationView, InvitationIssued } from '../../../packages/contracts/src/agency.contracts.js';

const path = resolve('packages/contracts/openapi.yaml');
type Operation = {
  operationId: string;
  parameters: { $ref?: string; name?: string }[];
  responses: Record<string, { description: string }>;
};
const api = JSON.parse(readFileSync(path, 'utf8')) as { paths: Record<string, Record<string, Operation>> };
const id = '00000000-0000-4000-8000-000000000001';

describe('HTTP v1 S01', () => {
  it('validates the complete OpenAPI document', async () => {
    await expect(SwaggerParser.validate(path)).resolves.toBeDefined();
  });
  it('covers every Design endpoint and enforces mutation headers', () => {
    const operations = Object.values(api.paths).flatMap(path => Object.entries(path));
    expect(operations.map(([, operation]) => operation.operationId).sort()).toEqual([
      'activateAgency', 'claimInvitation', 'createAgency', 'createInvitation',
      'getActivation', 'getInvitation', 'getOnboardingAgency', 'getSession',
      'issueInvitation', 'logout', 'oidcCallback', 'oidcStart',
      'retryProvisioning', 'revokeInvitation',
    ].sort());
    for (const [method, operation] of operations) {
      if (method !== 'post') continue;
      expect(operation.parameters).toContainEqual({ $ref: '#/components/parameters/Csrf' });
      expect(operation.parameters).toContainEqual({ $ref: '#/components/parameters/Origin' });
      if (['claimInvitation', 'logout'].includes(operation.operationId)) continue;
      expect(operation.parameters).toContainEqual({ $ref: '#/components/parameters/IdempotencyKey' });
    }
  });
  it('represents durable acceptance and safe current activation', () => {
    expect(AgencyAccepted.parse({ agencyId: id, operationId: id, state: 'PROVISIONING', version: '1', statusUrl: `/v1/agencies/${id}/activation` }).state).toBe('PROVISIONING');
    expect(ActivationView.parse({ agencyId: id, name: 'Agence A', state: 'ACTIVE', step: 'ACTIVE', version: '5', errorCode: null, retryable: false, canActivate: false, canRetry: false, automationEnabled: false }).automationEnabled).toBe(false);
  });
  it('refuses unbounded SQL or provider diagnostics in response payloads', () => {
    expect(ErrorResponse.safeParse({ code: 'DEPENDENCY_UNAVAILABLE', correlationId: id, retryable: true, message: 'SQL/provider secret canary' }).success).toBe(false);
  });
});


it('documents both strict claim branches and a secret-free response', () => {
  const document=JSON.parse(readFileSync(path,'utf8'));
  const claim=document.components.schemas.ClaimInvitation;
  expect(claim.oneOf).toHaveLength(2);
  expect(claim.oneOf[0]).toMatchObject({additionalProperties:false,maxProperties:0});
  expect(claim.oneOf[1]).toMatchObject({additionalProperties:false,required:['token']});
  expect(document.paths['/v1/onboarding/invitation/claim'].post.responses['200'].content['application/json'].schema)
    .toEqual({$ref:'#/components/schemas/ClaimContext'});
});


it('aligns OpenAPI and Zod on current invitation replay states without requiring a fresh link',()=>{
  const document=JSON.parse(readFileSync(path,'utf8'));
  expect(document.components.schemas.InvitationIssued.properties.status).toEqual(document.components.schemas.InvitationView.properties.status);
  for(const status of ['PENDING_IDENTITY','ISSUED','CLAIMED','EXPIRED','REVOKED']){
    const result=InvitationIssued.parse({invitationId:'00000000-0000-4000-8000-000000000071',status,version:'2'});
    expect(result.status).toBe(status);expect('enrollmentUrl' in result).toBe(false);
  }
});

it('documents admission100 before refresh and the bounded Retry-After without granting T06 activation',()=>{
  const document=JSON.parse(readFileSync(path,'utf8'));
  const creation=document.paths['/v1/agencies'].post;
  expect(creation.description).toContain('100');
  expect(creation.description).toContain('avant refresh');
  expect(creation.responses['429'].headers['Retry-After'].schema).toMatchObject({type:'integer',minimum:1,example:60});
  const status=document.paths['/v1/agencies/{id}/activation'].get;
  expect(status.description).toContain('sans refresh');
  expect(status.description).toContain('ADMIN PENDING');
  expect(status.responses['200'].headers['Cache-Control'].schema.enum).toEqual(['no-store']);
});
