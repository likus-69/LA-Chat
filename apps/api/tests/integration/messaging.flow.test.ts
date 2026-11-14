/**
 * Integration test: messaging flow.
 * Requires a running Postgres + the API server + seed data.
 */
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

const API_URL = process.env.API_URL || 'http://localhost:4000/api/v1';

async function api(path: string, init?: RequestInit & { token?: string }) {
  const { token, ...rest } = init || {};
  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(rest?.headers as Record<string, string>),
    },
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

async function login(identifier: string, password: string) {
  const { body } = await api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier, password }),
  });
  return body.tokens.accessToken;
}

describe('Messaging flow integration', () => {
  let teacherToken: string;
  let studentToken: string;
  let studentId: string;

  before(async () => {
    teacherToken = await login('teacher1@la-chat.local', 'Password1');
    studentToken = await login('student.s1e-0001@la-chat.local', 'Password1');
    // Get student's user ID
    const { body: studentProfile } = await api('/users/me', { token: studentToken });
    studentId = studentProfile.id;
  });

  it('teacher creates a private conversation with a student', async () => {
    const { status, body } = await api('/conversations/private', {
      method: 'POST',
      token: teacherToken,
      body: JSON.stringify({ participantId: studentId }),
    });
    assert.equal(status, 201);
    assert.equal(body.type, 'PRIVATE');
    assert.ok(body.id);
  });

  it('teacher sends a message', async () => {
    // First get the conversation
    const { body: list } = await api('/conversations', { token: teacherToken });
    assert.ok(list.items.length > 0);
    const convId = list.items[0].id;

    const { status, body } = await api(`/conversations/${convId}/messages`, {
      method: 'POST',
      token: teacherToken,
      body: JSON.stringify({
        conversationId: convId,
        clientMessageId: 'integration-test-' + Date.now(),
        type: 'TEXT',
        body: 'Hello from the integration test!',
      }),
    });
    assert.equal(status, 201);
    assert.equal(body.message.body, 'Hello from the integration test!');
    assert.equal(body.created, true);
  });

  it('idempotent send returns the same message', async () => {
    const { body: list } = await api('/conversations', { token: teacherToken });
    const convId = list.items[0].id;
    const clientMessageId = 'idempotent-test-' + Date.now();

    const first = await api(`/conversations/${convId}/messages`, {
      method: 'POST', token: teacherToken,
      body: JSON.stringify({ conversationId: convId, clientMessageId, body: 'Idempotent test' }),
    });
    assert.equal(first.status, 201);
    assert.equal(first.body.created, true);

    const second = await api(`/conversations/${convId}/messages`, {
      method: 'POST', token: teacherToken,
      body: JSON.stringify({ conversationId: convId, clientMessageId, body: 'Idempotent test' }),
    });
    assert.equal(second.status, 201);
    assert.equal(second.body.created, false);
    assert.equal(second.body.message.id, first.body.message.id);
  });

  it('student can list messages in the conversation', async () => {
    const { body: list } = await api('/conversations', { token: studentToken });
    const convId = list.items[0].id;

    const { status, body } = await api(`/conversations/${convId}/messages`, { token: studentToken });
    assert.equal(status, 200);
    assert.ok(body.items.length > 0);
  });

  it('student can search messages', async () => {
    const { status, body } = await api('/messages/search?q=integration', { token: studentToken });
    assert.equal(status, 200);
    assert.ok(body.items.length > 0);
  });
});
