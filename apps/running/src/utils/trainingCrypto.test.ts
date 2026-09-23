import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  decryptTrainingReport,
  encryptTrainingReport,
  parseEncryptedReport,
  validateReportPassword,
} from './trainingCrypto';

const password = 'test-only-random-password-J2&z9';
test('Web Crypto round-trip, randomized ciphertext and binding to the public report', async () => {
  const plaintext = JSON.stringify({
    sections: [{ heading: '私密', body: '测试隐私标记' }],
  });
  const a = await encryptTrainingReport(plaintext, password, 'report-a');
  const b = await encryptTrainingReport(plaintext, password, 'report-a');
  assert.notEqual(a.salt, b.salt);
  assert.notEqual(a.iv, b.iv);
  assert.notEqual(a.ciphertext, b.ciphertext);
  assert.doesNotMatch(JSON.stringify(a), /测试隐私|test-only-random/);
  assert.equal(await decryptTrainingReport(a, password, 'report-a'), plaintext);
  await assert.rejects(
    decryptTrainingReport(a, `${password}wrong`, 'report-a')
  );
  await assert.rejects(decryptTrainingReport(a, password, 'report-b'));
  const bytes = Uint8Array.from(atob(a.ciphertext), (c) => c.charCodeAt(0));
  bytes[0] ^= 1;
  const tampered = btoa(String.fromCharCode(...bytes));
  await assert.rejects(
    decryptTrainingReport({ ...a, ciphertext: tampered }, password, 'report-a')
  );
});
test('reject malformed envelopes and unbounded work before derivation', () => {
  const report = {
    version: 1,
    iterations: 600000,
    salt: 'AAAAAAAAAAAAAAAAAAAAAA==',
    iv: 'AAAAAAAAAAAAAAAA',
    ciphertext: 'AAAAAAAAAAAAAAAAAAAAAA==',
  };
  assert.doesNotThrow(() => parseEncryptedReport(report));
  for (const value of [
    null,
    { ...report, version: 2 },
    { ...report, iterations: 6000000000 },
    { ...report, salt: 'invalid' },
    { ...report, ciphertext: '!'.repeat(24) },
    { ...report, ciphertext: 'A'.repeat(86004) },
    { ...report, unexpected: 'plaintext' },
  ])
    assert.throws(() => parseEncryptedReport(value));
  for (const value of [
    '123456',
    '1234567890123456789012345',
    'x'.repeat(257),
    ` ${password}`,
  ])
    assert.throws(() => validateReportPassword(value));
});
