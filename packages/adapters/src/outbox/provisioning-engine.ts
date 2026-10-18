import { Inngest } from 'inngest';
import { serve } from 'inngest/node';
import { parseProvisioningEvent } from '@dossiercle/contracts/provisioning-events';
export function provisioningEngine(config: {
    signingKey: string;
    eventKey: string;
    baseUrl: string;
}, wake: (event: {
    id: string;
    name: string;
    data: unknown;
}) => Promise<{
    operationId: string | null;
    disposition: string;
}>, projectActivation?: (event:{id:string|null;name:string;data:unknown})=>Promise<unknown>) {
    const client = new Inngest({ id: 'dossiercle-t06', isDev: false, signingKey: config.signingKey,
        eventKey: config.eventKey, baseUrl: config.baseUrl });
    const fn = client.createFunction({ id: 'agency-provisioning', concurrency: 1, retries: 3,
        triggers: [{ event: 'agency.creation-accepted' }, { event: 'agency.provisioning-wakeup' }] }, async ({ event, step }) => {
        parseProvisioningEvent(event.name, event.data);
        if (typeof event.id !== 'string')
            throw new Error('PROVISIONING_EVENT_REFUSED');
        return await step.run('durable-attempt', async () => wake({ id: event.id!, name: event.name, data: event.data }));
    });
    const activation=projectActivation?client.createFunction({id:'agency-activation-projection',concurrency:1,retries:3,
        triggers:[{event:'agency.activated.v1'}]},async({event,step})=>await step.run('durable-activation-projection',async()=>
            projectActivation({id:event.id,name:event.name,data:event.data}))):undefined;
    return { client, listener: serve({ client, functions: [fn,...(activation?[activation]:[])], enableUnauthedSync: false }) };
}
