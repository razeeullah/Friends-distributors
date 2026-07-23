import { hash, verify } from "@node-rs/argon2";

const PASSWORD_HASH_OPTIONS = {
  algorithm: 2,
  memoryCost: 65_536,
  timeCost: 3,
  parallelism: 1,
  outputLen: 32,
} as const;

export const DUMMY_PASSWORD_HASH =
  "$argon2id$v=19$m=65536,t=3,p=1$0N4wmeey/Bi/csp5lmb84w$PlYpQ5wsOExXgIqRKkPmrmeA+zA6Idzbcb2OPQBs7yI";

export function hashPassword(password: string): Promise<string> {
  return hash(password, PASSWORD_HASH_OPTIONS);
}

export function verifyPassword(
  passwordHash: string,
  password: string,
): Promise<boolean> {
  return verify(passwordHash, password);
}
