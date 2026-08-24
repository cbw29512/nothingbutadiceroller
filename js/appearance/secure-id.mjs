const UUID_BYTE_COUNT = 16;

function uuidFromSecureBytes(cryptoApi) {
  try {
    if (typeof cryptoApi?.getRandomValues !== 'function') {
      throw new Error('Secure random values are unavailable in this browser.');
    }
    const bytes = new Uint8Array(UUID_BYTE_COUNT);
    cryptoApi.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  } catch (error) {
    console.error('Failed to generate UUID from secure random bytes:', error);
    throw error;
  }
}

export function createSecureId(prefix, cryptoApi = globalThis.crypto) {
  try {
    const normalizedPrefix = String(prefix || '').trim();
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,31}$/.test(normalizedPrefix)) {
      throw new Error('Secure id prefix must be 1-32 letters, numbers, underscores, or hyphens.');
    }
    if (!cryptoApi) throw new Error('Web Crypto is unavailable in this browser.');
    const uuid = typeof cryptoApi.randomUUID === 'function'
      ? cryptoApi.randomUUID()
      : uuidFromSecureBytes(cryptoApi);
    return `${normalizedPrefix}_${uuid}`;
  } catch (error) {
    console.error('Failed to create secure id:', error);
    throw error;
  }
}
