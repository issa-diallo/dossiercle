import { z } from 'zod';
const event=z.strictObject({eventId:z.uuid(),eventType:z.literal('agency.activation.prepared.v1'),version:z.string().regex(/^[1-9][0-9]*$/),correlation:z.uuid()});
const reservation=z.strictObject({reservationId:z.uuid(),operationId:z.uuid(),prepared:event,activatedEventId:z.uuid(),
  targetVersion:z.string().regex(/^[1-9][0-9]*$/),bindingHash:z.string().regex(/^[a-f0-9]{64}$/)});
export function parseActivationReservation(value:unknown){return reservation.parse(value);}
