import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const SCRYPT_OPTS = { N: 2 ** 14, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const KEY_LEN = 32;

/** Hash a password with a fresh random salt (scrypt, hex-encoded). */
export function hashPassword(password: string): { hash: string; salt: string } {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, Buffer.from(salt, "hex"), KEY_LEN, SCRYPT_OPTS).toString("hex");
  return { hash, salt };
}

/** Constant-time comparison of a candidate against the stored hash. */
export function verifyPassword(password: string, salt: string, expected: string): boolean {
  try {
    const actual = scryptSync(password, Buffer.from(salt, "hex"), KEY_LEN, SCRYPT_OPTS);
    const expectedBuf = Buffer.from(expected, "hex");
    if (actual.length !== expectedBuf.length) return false;
    return timingSafeEqual(actual, expectedBuf);
  } catch {
    return false;
  }
}
