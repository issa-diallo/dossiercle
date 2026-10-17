import { z } from 'zod';
const positiveVersion = z.string().regex(/^[1-9][0-9]{0,18}$/);
export const creationAcceptedData = z.strictObject({ schemaVersion: z.literal(1), agencyId: z.uuid(), resourceId: z.uuid(), version: positiveVersion });
export const provisioningWakeupData = z.strictObject({ schemaVersion: z.literal(1), agencyId: z.uuid(), resourceId: z.uuid(), version: positiveVersion,
    expectedOperationVersion: positiveVersion, targetAttempt: z.number().int().min(1).max(4), deliveryRound: z.number().int().min(1).max(3) });
export const provisioningEventName = z.enum(['agency.creation-accepted', 'agency.provisioning-wakeup']);
export function parseProvisioningEvent(name: string, data: unknown) {
    if (name === 'agency.creation-accepted')
        return { name: 'agency.creation-accepted' as const, data: creationAcceptedData.parse(data) };
    if (name === 'agency.provisioning-wakeup')
        return { name: 'agency.provisioning-wakeup' as const, data: provisioningWakeupData.parse(data) };
    throw new Error('PROVISIONING_EVENT_REFUSED');
}
