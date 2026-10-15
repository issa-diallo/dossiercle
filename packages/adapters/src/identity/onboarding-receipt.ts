import { createHash } from 'node:crypto';
import type { PoolClient } from 'pg';
import { UUID } from '@dossiercle/contracts';
import { putT05Record,readT05Record,t05Hash,T05Closed } from '../postgres/t05.repository.js';
export interface AdmissionContext {version:string;tokenHash:string;admissionReceipt:string}
export interface OnboardingReceipt extends AdmissionContext {cookieHash:string;subject:string;root:string;epoch:string;issuedAt:string}
export const RECEIPT_OPERATION='identity.onboarding-receipt.v1';
export function onboardingReceiptKey(cookieHash:string):string{
  const hex=createHash('sha256').update(RECEIPT_OPERATION+':'+cookieHash).digest('hex');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-4${hex.slice(13,16)}-8${hex.slice(17,20)}-${hex.slice(20,32)}`;
}
export async function checkAdmission(client:PoolClient,input:AdmissionContext&{subject:string;root:string;epoch:string}){
  if(!/^[1-9][0-9]*$/.test(input.version)||!/^[a-f0-9]{64}$/.test(input.tokenHash)||!UUID.safeParse(input.admissionReceipt).success)throw new T05Closed('INVITATION_UNAVAILABLE');
  const admission=await readT05Record<{admissionReceipt:string;tokenHash:string;epoch:string;root:string;subject:string;version:string}>(client,input.subject,'identity.enrollment.grant.'+input.version,input.root);
  if(!admission||admission.admissionReceipt!==input.admissionReceipt||admission.tokenHash!==input.tokenHash||admission.epoch!==input.epoch
    ||admission.root!==input.root||admission.subject!==input.subject||admission.version!==input.version)throw new T05Closed('INVITATION_UNAVAILABLE');
}
export async function writeOnboardingReceipt(client:PoolClient,receipt:OnboardingReceipt){
  await checkAdmission(client,receipt);
  await putT05Record(client,receipt.subject,RECEIPT_OPERATION,onboardingReceiptKey(receipt.cookieHash),t05Hash(JSON.stringify(receipt)),receipt.root,receipt);
}
export async function readOnboardingReceipt(client:PoolClient,input:{cookieHash:string;subject:string;root:string;epoch:string;version:string;tokenHash:string|null;issuedAt:string}):Promise<OnboardingReceipt>{
  const receipt=await readT05Record<OnboardingReceipt>(client,input.subject,RECEIPT_OPERATION,onboardingReceiptKey(input.cookieHash));
  if(!receipt||receipt.cookieHash!==input.cookieHash||receipt.subject!==input.subject||receipt.root!==input.root||receipt.epoch!==input.epoch
    ||receipt.version!==input.version||receipt.tokenHash!==input.tokenHash||receipt.issuedAt!==input.issuedAt)throw new T05Closed('INVITATION_UNAVAILABLE');
  await checkAdmission(client,receipt);return receipt;
}
