import { compare, hash } from "bcryptjs";

const HASH_ROUNDS = 12;
const DUMMY_HASH = "$2b$12$v0mG9yG6yvQlyDYAAeGlVeC9P9QXHGFDCGlTZ6fLOrH6mD6I1q9oK";

export function hashPassword(password: string): Promise<string> {
  return hash(password, HASH_ROUNDS);
}

export function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return compare(password, passwordHash);
}

export async function performDummyPasswordCheck(password: string): Promise<void> {
  await compare(password, DUMMY_HASH);
}

