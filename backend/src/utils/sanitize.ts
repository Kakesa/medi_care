const REDACTED_KEYS = new Set([
  'password',
  'passwordhash',
  'currentpassword',
  'newpassword',
  'confirmpassword',
  'token',
  'authorization',
  'jwt',
  'diagnosis',
  'prescription',
  'symptoms',
  'treatment',
  'results',
  'allergies',
  'bloodtype',
  'notes',
]);

export function sanitize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitize(item));
  }

  if (value && typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (REDACTED_KEYS.has(key.toLowerCase())) {
        output[key] = '[redacted]';
      } else {
        output[key] = sanitize(nested);
      }
    }
    return output;
  }

  return value;
}
