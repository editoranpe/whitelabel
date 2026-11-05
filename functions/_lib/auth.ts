const encoder = new TextEncoder();
/** workerd caps PBKDF2 iterations at 100,000; a larger count throws NotSupportedError.
 * Keep this at the maximum supported value. Use a long, unique password and rate limiting.
 * If upgrading hashing in the future, version the stored format and support migration.
 */
export const PASSWORD_HASH_ITERATIONS = 100_000;
export const NOW = () => new Date().toISOString();
export const uuid = () => crypto.randomUUID();

export function hex(bytes: Uint8Array): string {
  return [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
export function unhex(input: string): Uint8Array {
  if (!/^(?:[0-9a-f]{2})+$/i.test(input)) throw new Error('Hash inválido');
  return new Uint8Array(input.match(/.{2}/g)!.map(byte => parseInt(byte, 16)));
}
export function randomToken(): string {
  return hex(crypto.getRandomValues(new Uint8Array(32)));
}
export async function sha256(input: string): Promise<string> {
  return hex(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(input))));
}
export async function passwordHash(password: string, salt?: string): Promise<{ salt: string; hash: string }> {
  if (password.length < 12 || password.length > 128) throw new Error('A senha deve ter de 12 a 128 caracteres');
  const passwordSalt = salt ?? randomToken();
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), { name: 'PBKDF2' }, false, ['deriveBits']);
  const derived = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: unhex(passwordSalt) as BufferSource, iterations: PASSWORD_HASH_ITERATIONS }, key, 256);
  return { salt: passwordSalt, hash: hex(new Uint8Array(derived)) };
}
export async function verifyPassword(password: string, salt: string, expected: string): Promise<boolean> {
  const { hash } = await passwordHash(password, salt);
  const a = unhex(hash), b = unhex(expected);
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i];
  return difference === 0;
}
export function readSessionCookie(request: Request): string | null {
  const match = request.headers.get('Cookie')?.match(/(?:^|;\s*)cib_session=([a-f0-9]{64})(?:;|$)/);
  return match ? match[1] : null;
}
export function sessionCookie(token: string, maxAge = 12 * 3600): string {
  return `cib_session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}
export function expireCookie(): string {
  return 'cib_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0';
}
