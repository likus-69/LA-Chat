import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { changePasswordSchema } from '@la-chat/validation';
import { generateTemporaryPassword } from '../../src/users/temp-password';

describe('changePasswordSchema', () => {
  it('accepts a valid password change', () => {
    const r = changePasswordSchema.safeParse({
      currentPassword: 'Password1',
      newPassword: 'NewPass123',
    });
    assert.equal(r.success, true);
  });

  it('rejects an empty current password', () => {
    const r = changePasswordSchema.safeParse({ currentPassword: '', newPassword: 'NewPass123' });
    assert.equal(r.success, false);
  });

  it('enforces the password policy on the new password', () => {
    const r = changePasswordSchema.safeParse({
      currentPassword: 'Password1',
      newPassword: 'weakpass',
    });
    assert.equal(r.success, false);
  });
});

describe('generateTemporaryPassword', () => {
  it('satisfies the password policy', () => {
    for (let i = 0; i < 25; i++) {
      const pwd = generateTemporaryPassword();
      assert.ok(pwd.length >= 8, `too short: ${pwd.length}`);
      assert.match(pwd, /[A-Z]/);
      assert.match(pwd, /[a-z]/);
      assert.match(pwd, /[0-9]/);
      assert.equal(changePasswordSchema.safeParse({ currentPassword: 'x', newPassword: pwd }).success, true);
    }
  });

  it('does not repeat between calls', () => {
    const a = generateTemporaryPassword();
    const b = generateTemporaryPassword();
    assert.notEqual(a, b);
  });

  it('honours a custom length', () => {
    assert.equal(generateTemporaryPassword(16).length, 16);
  });
});
