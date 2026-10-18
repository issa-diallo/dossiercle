import { describe, expect, it } from 'vitest';
import { ACTIVATION_EVENT, parseActivationEvent } from '../src/activation.events.js';

const event = { schemaVersion: 1, agencyId: '00000000-0000-4000-8000-000000000001',
  resourceId: '00000000-0000-4000-8000-000000000002', version: '2' };

describe('T07 activation event', () => {
  it('accepts only an opaque versioned event payload', () => {
    expect(parseActivationEvent(ACTIVATION_EVENT, event).data).toEqual(event);
    expect(() => parseActivationEvent(ACTIVATION_EVENT, { ...event, secretRef: 'canary' })).toThrow();
    expect(() => parseActivationEvent('agency.creation-accepted', event)).toThrow('ACTIVATION_EVENT_REFUSED');
  });
});
