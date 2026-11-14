/**
 * Integration test: full auth flow.
 * Requires a running Postgres + the API server.
 * Run with: docker compose up -d db && pnpm --filter @la-chat/api test:integration
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';

const API_URL = process.env.API_URL || 'http://localhost:4000/api/v1';
const prisma = new PrismaClient();

async function api(path: string, init?: RequestInit) {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers as Record<string, string>) },
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

describe('Auth flow integration', () => {
  before(async () => {
    // Clean up any test data
    await prisma.user.deleteMany({ where: { email: { contains: 'test-integration' } } });
  });

  after(async () => {
    await prisma.user.deleteMany({ where: { email: { contains: 'test-integration' } } });
    await prisma.$disconnect();
  });

  it('registers a staff member (pending)', async () => {
    const { status, body } = await api('/auth/register/staff', {
      method: 'POST',
      body: JSON.stringify({
        staffNo: 'TEST-INT-001',
        fullName: 'Integration Test Teacher',
        email: 'test-integration-teacher@la-chat.local',
        password: 'Password1',
        role: 'TEACHER',
        department: 'Mathematics',
      }),
    });
    assert.equal(status, 201);
    assert.equal(body.status, 'PENDING');
  });

  it('rejects login for a pending account', async () => {
    const { status, body } = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier: 'test-integration-teacher@la-chat.local', password: 'Password1' }),
    });
    assert.equal(status, 403);
  });

  it('logs in as ICT admin to approve the account', async () => {
    const { status, body } = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier: 'ict.admin@la-chat.local', password: 'Password1' }),
    });
    assert.equal(status, 200);
    assert.ok(body.tokens.accessToken);

    // Find the pending user and approve
    const pendingUser = await prisma.user.findUnique({
      where: { email: 'test-integration-teacher@la-chat.local' },
    });
    assert.ok(pendingUser);

    const approveRes = await api(`/users/${pendingUser.id}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${body.tokens.accessToken}` },
    });
    assert.equal(approveRes.status, 200);
    assert.equal(approveRes.body.status, 'ACTIVE');
  });

  it('logs in as the approved teacher', async () => {
    const { status, body } = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier: 'test-integration-teacher@la-chat.local', password: 'Password1' }),
    });
    assert.equal(status, 200);
    assert.ok(body.tokens.accessToken);
    assert.ok(body.tokens.refreshToken);
    assert.equal(body.user.fullName, 'Integration Test Teacher');
  });

  it('rejects invalid credentials', async () => {
    const { status } = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier: 'test-integration-teacher@la-chat.local', password: 'WrongPassword1' }),
    });
    assert.equal(status, 401);
  });
});
