/** Padrão BR Code, QR estático Pix. Não consulta o banco e NÃO confirma pagamento. */
export function emv(id: string, value: string): string {
  if (id.length !== 2 || value.length > 99) throw new Error('Campo Pix inválido');
  return `${id}${String(value.length).padStart(2, '0')}${value}`;
}

export function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc & 0x8000) !== 0 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function clean(value: string, max: number): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9 .&/-]/g, '').trim().toUpperCase().slice(0, max);
}

export function buildPixCode(args: { key: string; receiver: string; city: string; amountCents: number; txid: string }): string {
  const key = args.key.trim();
  if (key.length < 3 || key.length > 77 || /[\n\r]/.test(key)) throw new Error('Chave Pix inválida');
  if (!Number.isSafeInteger(args.amountCents) || args.amountCents <= 0 || args.amountCents > 999999999) throw new Error('Valor Pix inválido');
  const receiver = clean(args.receiver, 25);
  const city = clean(args.city, 15);
  if (!receiver || !city) throw new Error('Configure o nome do recebedor e a cidade');
  const txid = args.txid.replace(/[^a-zA-Z0-9]/g, '').slice(0, 25);
  if (!txid) throw new Error('Identificador inválido');
  const account = emv('00', 'br.gov.bcb.pix') + emv('01', key);
  const payload =
    emv('00', '01') +
    emv('26', account) +
    emv('52', '0000') +
    emv('53', '986') +
    emv('54', (args.amountCents / 100).toFixed(2)) +
    emv('58', 'BR') +
    emv('59', receiver) +
    emv('60', city) +
    emv('62', emv('05', txid)) +
    '6304';
  return payload + crc16(payload);
}
