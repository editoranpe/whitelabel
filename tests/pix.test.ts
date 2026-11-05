import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPixCode, crc16, emv } from '../functions/_lib/pix.ts';

test('CRC16 CCITT para payload conhecido', () => {
  assert.equal(crc16('123456789'), '29B1');
});

test('código Pix estático possui chave, recebedor, valor e CRC válidos', () => {
  const code = buildPixCode({key:'financeiro@exemplo.com.br',receiver:'Conectando Ideias Brasil',city:'Blumenau',amountCents:4000,txid:'CIB2026110001'});
  assert.ok(code.startsWith('000201'));
  assert.ok(code.includes(emv('01','financeiro@exemplo.com.br')));
  assert.ok(code.includes('540540.00'));
  assert.ok(code.includes('5802BR'));
  assert.ok(code.includes(emv('59','CONECTANDO IDEIAS BRASIL')));
  assert.ok(code.includes('6008BLUMENAU'));
  assert.ok(code.endsWith(crc16(code.slice(0,-4))));
});

test('código Pix rejeita valores e chaves inválidos', () => {
  assert.throws(() => buildPixCode({key:'',receiver:'Grupo',city:'Blumenau',amountCents:4000,txid:'abc'}));
  assert.throws(() => buildPixCode({key:'test@example.com',receiver:'Grupo',city:'Blumenau',amountCents:0,txid:'abc'}));
});
