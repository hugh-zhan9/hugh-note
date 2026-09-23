const ITERATIONS = 600_000;
const encoder = new TextEncoder();
export interface EncryptedTrainingReport {
  version: 1;
  iterations: 600000;
  salt: string;
  iv: string;
  ciphertext: string;
}

const encode = (bytes: Uint8Array) =>
  btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(''));
function decode(value: string): Uint8Array<ArrayBuffer> {
  if (
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
      value
    )
  )
    throw new Error('Invalid encrypted report');
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

export function validateReportPassword(password: string) {
  if (
    password.length < 20 ||
    password.length > 256 ||
    /^\d+$/.test(password) ||
    password.trim() !== password
  )
    throw new Error(
      'Report password must be 20–256 characters, not only digits, with no surrounding whitespace'
    );
}

async function deriveKey(
  password: string,
  salt: Uint8Array<ArrayBuffer>,
  usage: 'encrypt' | 'decrypt'
) {
  const material = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    [usage]
  );
}

export async function encryptTrainingReport(
  plaintext: string,
  password: string,
  reportId: string
): Promise<EncryptedTrainingReport> {
  validateReportPassword(password);
  const bytes = encoder.encode(plaintext);
  if (bytes.length > 64_000)
    throw new Error('Private report exceeds size limit');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt, 'encrypt');
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
      additionalData: encoder.encode(`running-training-v1:${reportId}`),
      tagLength: 128,
    },
    key,
    bytes
  );
  return {
    version: 1,
    iterations: ITERATIONS,
    salt: encode(salt),
    iv: encode(iv),
    ciphertext: encode(new Uint8Array(ciphertext)),
  };
}

export function parseEncryptedReport(value: unknown): EncryptedTrainingReport {
  if (!value || typeof value !== 'object')
    throw new Error('Invalid encrypted report');
  const report = value as EncryptedTrainingReport;
  if (
    Object.keys(report).sort().join(',') !==
      'ciphertext,iterations,iv,salt,version' ||
    report.version !== 1 ||
    report.iterations !== ITERATIONS ||
    typeof report.salt !== 'string' ||
    report.salt.length !== 24 ||
    typeof report.iv !== 'string' ||
    report.iv.length !== 16 ||
    typeof report.ciphertext !== 'string' ||
    report.ciphertext.length > 86_000 ||
    report.ciphertext.length < 24 ||
    decode(report.salt).length !== 16 ||
    decode(report.iv).length !== 12 ||
    decode(report.ciphertext).length < 16
  )
    throw new Error('Invalid encrypted report');
  return report;
}

export async function decryptTrainingReport(
  value: unknown,
  password: string,
  reportId: string
): Promise<string> {
  const report = parseEncryptedReport(value);
  if (password.length > 256) throw new Error('Invalid password');
  const key = await deriveKey(password, decode(report.salt), 'decrypt');
  const plaintext = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: decode(report.iv),
      additionalData: encoder.encode(`running-training-v1:${reportId}`),
      tagLength: 128,
    },
    key,
    decode(report.ciphertext)
  );
  return new TextDecoder('utf-8', { fatal: true }).decode(plaintext);
}
