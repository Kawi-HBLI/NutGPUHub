import { argon2id, hash, verify } from 'argon2';

export function hashPassword(password: string): Promise<string> {
  return hash(password, { type: argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
}

const decoyHash = await hashPassword('nutgpuhub-unknown-account');

export async function verifyPassword(password: string, stored?: string): Promise<boolean> {
  const credential = stored?.startsWith('$argon2id$') ? stored : undefined;
  const matches = await verify(credential ?? decoyHash, password);
  return credential !== undefined && matches;
}
