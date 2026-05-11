import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

// Lightweight PIN hashing using scrypt. PINs are typically 4-8 digits so we
// rely on rate-limiting at the application layer; scrypt parameters are kept
// modest to remain free-tier friendly.

export function hashPin(pin: string): { hash: string; salt: string } {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(pin, salt, 64).toString("hex");
  return { hash, salt };
}

export function verifyPin(pin: string, hash: string, salt: string): boolean {
  const computed = scryptSync(pin, salt, 64);
  const stored = Buffer.from(hash, "hex");
  if (stored.length !== computed.length) return false;
  return timingSafeEqual(computed, stored);
}

export function randomInviteCode(): string {
  // 6-char base32-ish, easy to type
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(6);
  let out = "";
  for (let i = 0; i < 6; i++) out += alphabet[bytes[i]! % alphabet.length];
  return out;
}
