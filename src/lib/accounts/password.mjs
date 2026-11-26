import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
const derive = (password, salt) =>
  new Promise((resolve, reject) =>
    scrypt(
      password,
      salt,
      64,
      { N: 131072, r: 8, p: 1, maxmem: 192 * 1024 * 1024 },
      (error, key) => (error ? reject(error) : resolve(key)),
    ),
  );
export function strong(password, email = '') {
  return (
    typeof password === 'string' &&
    password.length >= 14 &&
    password.length <= 128 &&
    new Set(password.toLowerCase()).size >= 6 &&
    !/(password|qwerty|letmein|welcome123|admin123|123456|iloveyou|changeme)/i.test(
      password,
    ) &&
    (!email || !password.toLowerCase().includes(email.toLowerCase()))
  );
}
export async function hashPassword(password) {
  const salt = randomBytes(16);
  return (
    'scrypt-v1:' +
    salt.toString('hex') +
    ':' +
    (await derive(password, salt)).toString('hex')
  );
}
export async function matches(password, hash) {
  const [, salt, key] = (hash ?? '').split(':');
  const actual = await derive(
    password,
    Buffer.from(salt || '00'.repeat(16), 'hex'),
  );
  return (
    !!key &&
    key.length === 128 &&
    timingSafeEqual(actual, Buffer.from(key, 'hex'))
  );
}
