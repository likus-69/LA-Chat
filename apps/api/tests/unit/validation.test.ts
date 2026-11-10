import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  loginSchema,
  registerStudentSchema,
  registerStaffSchema,
  passwordSchema,
} from '@la-chat/validation';
import { RoleName } from '@la-chat/shared-types';

describe('loginSchema', () => {
  it('accepts a valid login', () => {
    const r = loginSchema.safeParse({ identifier: 'student.s1e-0001@la-chat.local', password: 'Password1' });
    assert.equal(r.success, true);
  });

  it('rejects an empty identifier', () => {
    const r = loginSchema.safeParse({ identifier: '', password: 'Password1' });
    assert.equal(r.success, false);
  });
});

describe('passwordSchema', () => {
  it('accepts a strong password', () => {
    assert.ok(passwordSchema.safeParse('Password1').success);
  });

  it('rejects a password without a digit', () => {
    assert.equal(passwordSchema.safeParse('StrongPass').success, false);
  });

  it('rejects a password without an uppercase letter', () => {
    assert.equal(passwordSchema.safeParse('password1').success, false);
  });

  it('rejects a password shorter than 8 chars', () => {
    assert.equal(passwordSchema.safeParse('Pwd1').success, false);
  });
});

describe('registerStudentSchema', () => {
  it('accepts a valid student registration', () => {
    const r = registerStudentSchema.safeParse({
      admissionNo: 'S1E-0001',
      fullName: 'Test Student',
      email: 'test@la-chat.local',
      phone: '+256700000099',
      password: 'Password1',
      classId: '00000000-0000-0000-0000-000000000001',
      streamId: '00000000-0000-0000-0000-000000000002',
    });
    assert.equal(r.success, true);
  });

  it('rejects an invalid admission number with special chars', () => {
    const r = registerStudentSchema.safeParse({
      admissionNo: 'S1E@0001',
      fullName: 'Test Student',
      password: 'Password1',
      classId: '00000000-0000-0000-0000-000000000001',
      streamId: '00000000-0000-0000-0000-000000000002',
    });
    assert.equal(r.success, false);
  });
});

describe('registerStaffSchema', () => {
  it('accepts a teacher registration', () => {
    const r = registerStaffSchema.safeParse({
      staffNo: 'T-0001',
      fullName: 'Test Teacher',
      email: 'teacher@la-chat.local',
      password: 'Password1',
      role: RoleName.TEACHER,
      department: 'Mathematics',
    });
    assert.equal(r.success, true);
  });

  it('rejects a STUDENT role on the staff endpoint', () => {
    const r = registerStaffSchema.safeParse({
      staffNo: 'X-0001',
      fullName: 'Test',
      password: 'Password1',
      role: RoleName.STUDENT,
    });
    assert.equal(r.success, false);
  });
});
