/** Password hashing (scrypt) — shared by the app, the CLI script and the bootstrap. */
import { randomBytes, scrypt as scryptCallback, timingSafeEqual, type ScryptOptions } from "node:crypto";

export const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 } as const;
export const HASH_PREFIX = "scrypt";

/** Promise wrapper around node's scrypt (promisify loses the options argument). */
export function scrypt(password: string, salt: Buffer, keylen: number, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, keylen, options, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
  return [
    HASH_PREFIX,
    SCRYPT.N,
    SCRYPT.r,
    SCRYPT.p,
    salt.toString("base64"),
    derived.toString("base64"),
  ].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== HASH_PREFIX) return false;
  const [, n, r, p, saltB64, hashB64] = parts;
  try {
    const salt = Buffer.from(saltB64, "base64");
    const expected = Buffer.from(hashB64, "base64");
    const derived = await scrypt(password, salt, expected.length, { N: Number(n), r: Number(r), p: Number(p) });
    return derived.length === expected.length && timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}
