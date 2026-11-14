/**
 * Integration test: moderation flow.
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
  const { body } = await api('/auth/login', { method: 'POST', body: JSON.stringify({ identifier, password }) });
  return body.tokens.accessToken;
}

describe('Moderation flow integration', () => {
  let studentToken: string;
  let headteacherToken: string;
  let reportedMessageId: string;

  before(async () => {
    studentToken = await login('student.s1e-0001@la-chat.local', 'Password1');
    headteacherToken = await login('headteacher@la-chat.local', 'Password1');

    // Get a message to report
    const { body: convList } = await api('/conversations', { token: studentToken });
    if (convList.items.length > 0) {
      const { body: msgList } = await api(`/conversations/${convList.items[0].id}/messages`, { token: studentToken });
      if (msgList.items.length > 0) {
        reportedMessageId = msgList.items[0].id;
      }
    }
  });

  it('student reports a message', async () => {
    if (!reportedMessageId) return; // skip if no messages
    const { status, body } = await api('/moderation/reports', {
      method: 'POST',
      token: studentToken,
      body: JSON.stringify({
        reportedMessageId,
        category: 'INAPPROPRIATE',
        reason: 'Integration test: testing the report flow',
      }),
    });
    assert.equal(status, 201);
    assert.equal(body.status, 'OPEN');
    assert.equal(body.category, 'INAPPROPRIATE');
  });

  it('headteacher views the moderation queue', async () => {
    const { status, body } = await api('/moderation/reports', { token: headteacherToken });
    assert.equal(status, 200);
    assert.ok(body.items.length > 0);
  });

  it('headteacher takes action on a report', async () => {
    const { body: queue } = await api('/moderation/reports', { token: headteacherToken });
    const report = queue.items[0];
    if (!report) return;

    const { status, body } = await api(`/moderation/reports/${report.id}/action`, {
      method: 'POST',
      token: headteacherToken,
      body: JSON.stringify({ action: 'DISMISS', note: 'Integration test: false report' }),
    });
    assert.equal(status, 200);
    assert.equal(body.status, 'DISMISSED');
  });

  it('student cannot access the moderation queue', async () => {
    const { status } = await api('/moderation/reports', { token: studentToken });
    assert.equal(status, 403);
  });
});
