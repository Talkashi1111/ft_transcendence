import argon2 from 'argon2';

/**
 * Hash a password using Argon2id (recommended variant)
 * Argon2 automatically generates and embeds the salt in the hash
 */
export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id, // Recommended: resistant to both side-channel and GPU attacks
    memoryCost: 65536,     // 64 MB memory
    timeCost: 3,           // 3 iterations
    parallelism: 4,        // 4 parallel threads
  });
}

/**
 * Verify a password against an Argon2 hash
 */
export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  try {
    return await argon2.verify(hashedPassword, password);
  } catch {
    return false;
  }
}
