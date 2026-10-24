/** Public synthetic identifiers only. Credentials are generated into private tmpfs. */
export const s01Fixtures = Object.freeze({
  owner: '00000000-0000-4000-8000-000000000001',
  adminA: '00000000-0000-4000-8000-000000000011', adminB: '00000000-0000-4000-8000-000000000012',
  standard: '00000000-0000-4000-8000-000000000013', habilited: '00000000-0000-4000-8000-000000000014',
  agencyA: '00000000-0000-4000-8000-000000000021', agencyB: '00000000-0000-4000-8000-000000000022',
  names: ['Agence A', 'Agence B'],
});

/** Keep synthetic HTTP failures from publishing request headers or their original cause. */
export async function safeSyntheticResponse<T>(read: () => Promise<T>): Promise<T> {
  try { return await read(); }
  catch { throw new Error('SYNTHETIC_RESPONSE_UNAVAILABLE'); }
}
