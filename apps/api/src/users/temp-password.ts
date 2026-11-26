import { randomInt } from 'node:crypto';

// Ambiguous characters (0/O, 1/l/I) are excluded so a temporary password can
// be read aloud or written on a slip without transcription errors.
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LOWER = 'abcdefghijkmnopqrstuvwxyz';
const DIGITS = '23456789';

/**
 * Generates a readable temporary password that satisfies the password policy
 * (8+ chars, uppercase, lowercase, digit) for admin-assisted account recovery.
 */
export function generateTemporaryPassword(length = 12): string {
  const all = UPPER + LOWER + DIGITS;
  const chars = [
    UPPER[randomInt(UPPER.length)],
    LOWER[randomInt(LOWER.length)],
    DIGITS[randomInt(DIGITS.length)],
  ];
  while (chars.length < length) chars.push(all[randomInt(all.length)]);

  // Fisher-Yates shuffle so the guaranteed characters are not always first.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}
