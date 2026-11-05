import test from 'node:test';
import assert from 'node:assert/strict';
import { PASSWORD_HASH_ITERATIONS, passwordHash, verifyPassword } from '../functions/_lib/auth.ts';

test('PBKDF2 iterations stay within Cloudflare Workers limit', () => {
  assert.equal(PASSWORD_HASH_ITERATIONS, 100_000);
});

test('initial admin passwords can be hashed and verified', async () => {
  const password = 'ExemploUnicoDeTeste#2026';
  const first = await passwordHash(password);
  const second = await passwordHash(password);
  assert.match(first.salt, /^[0-9a-f]{64}$/);
  assert.match(first.hash, /^[0-9a-f]{64}$/);
  assert.notEqual(first.salt, second.salt, 'Each account must receive a unique salt');
  assert.notEqual(first.hash, second.hash, 'Different salts must produce different hashes');
  assert.equal(await verifyPassword(password, first.salt, first.hash), true);
  assert.equal(await verifyPassword('SenhaIncorreta#2026', first.salt, first.hash), false);
});

test('short passwords are rejected before deriving a hash', async () => {
  await assert.rejects(passwordHash('12345'), /12 a 128 caracteres/);
});
