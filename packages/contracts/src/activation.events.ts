import { ActivationEventData } from './agency.contracts.js';
export { ActivationEventData } from './agency.contracts.js';

export const ACTIVATION_EVENT = 'agency.activated.v1' as const;
export function parseActivationEvent(name: string, data: unknown) {
  if (name !== ACTIVATION_EVENT) throw new Error('ACTIVATION_EVENT_REFUSED');
  return { name: ACTIVATION_EVENT, data: ActivationEventData.parse(data) };
}
