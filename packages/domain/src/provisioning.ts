export type ProvisioningStep = 'ACCEPTED' | 'DATABASE_CREATED' | 'SCHEMA_READY' | 'SECRETS_REFERENCED' | 'READY';
export type ProvisioningStatus = 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';
export type FailureClass = 'SAFE_RETRY' | 'TERMINAL' | 'UNCERTAIN';
export interface ProvisioningState {
    step: ProvisioningStep;
    status: ProvisioningStatus;
    attempt: number;
    version: bigint;
    retryable: boolean;
}
export function classifyProvisioningFailure(input: {
    effectStarted: boolean;
    effectConfirmed: boolean;
    closed: boolean;
    terminal?: boolean;
}): FailureClass {
    if (input.terminal)
        return 'TERMINAL';
    if (input.effectStarted && !input.effectConfirmed)
        return 'UNCERTAIN';
    return input.closed ? 'SAFE_RETRY' : 'UNCERTAIN';
}
export function beginProvisioning(state: ProvisioningState): ProvisioningState {
    if (state.status === 'SUCCEEDED' || state.status === 'RUNNING' || state.attempt >= 4 || !['PENDING', 'FAILED'].includes(state.status) || (!state.retryable && state.status === 'FAILED'))
        throw new Error('PROVISIONING_NOT_RETRYABLE');
    return { ...state, status: 'RUNNING', attempt: state.attempt + 1, version: state.version + 1n, retryable: false };
}
export function confirmProvisioningStep(state: ProvisioningState, next: ProvisioningStep): ProvisioningState {
    const order: ProvisioningStep[] = ['ACCEPTED', 'DATABASE_CREATED', 'SCHEMA_READY', 'SECRETS_REFERENCED', 'READY'];
    if (state.status !== 'RUNNING' || order.indexOf(next) !== order.indexOf(state.step) + 1)
        throw new Error('PROVISIONING_STEP_DIVERGED');
    return { ...state, step: next, status: next === 'READY' ? 'SUCCEEDED' : 'RUNNING', version: state.version + 1n };
}
export function failProvisioning(state: ProvisioningState, failure: FailureClass): ProvisioningState {
    if (state.status !== 'RUNNING')
        throw new Error('PROVISIONING_STATE_DIVERGED');
    return { ...state, status: 'FAILED', retryable: failure === 'SAFE_RETRY' && state.attempt < 4, version: state.version + 1n };
}
