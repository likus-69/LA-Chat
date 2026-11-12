import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  sendMessageSchema,
  editMessageSchema,
  reactSchema,
  markReadSchema,
  searchMessagesSchema,
  listMessagesSchema,
  createPrivateConversationSchema,
  createGroupConversationSchema,
  listConversationsSchema,
} from '@la-chat/validation';

describe('createPrivateConversationSchema', () => {
  it('accepts a valid participantId', () => {
    const r = createPrivateConversationSchema.safeParse({
      participantId: '00000000-0000-0000-0000-000000000001',
    });
    assert.ok(r.success);
  });

  it('rejects a non-UUID participantId', () => {
    const r = createPrivateConversationSchema.safeParse({ participantId: 'not-a-uuid' });
    assert.equal(r.success, false);
  });
});

describe('createGroupConversationSchema', () => {
  it('accepts a valid group conversation', () => {
    const r = createGroupConversationSchema.safeParse({
      name: 'S1 Maths Class Group',
      description: 'Maths discussions for S1',
      participantIds: [
        '00000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000002',
      ],
    });
    assert.ok(r.success);
  });

  it('rejects an empty participantIds array', () => {
    const r = createGroupConversationSchema.safeParse({
      name: 'Empty group',
      participantIds: [],
    });
    assert.equal(r.success, false);
  });

  it('rejects a name that is too short', () => {
    const r = createGroupConversationSchema.safeParse({
      name: 'A',
      participantIds: ['00000000-0000-0000-0000-000000000001'],
    });
    assert.equal(r.success, false);
  });
});

describe('sendMessageSchema', () => {
  it('accepts a valid TEXT message', () => {
    const r = sendMessageSchema.safeParse({
      conversationId: '00000000-0000-0000-0000-000000000001',
      clientMessageId: 'web-1234567890-abc123',
      type: 'TEXT',
      body: 'Hello, world!',
    });
    assert.ok(r.success);
  });

  it('defaults type to TEXT when omitted', () => {
    const r = sendMessageSchema.safeParse({
      conversationId: '00000000-0000-0000-0000-000000000001',
      clientMessageId: 'web-1234567890-abc123',
      body: 'Hello',
    });
    assert.ok(r.success);
    if (r.success) assert.equal(r.data.type, 'TEXT');
  });

  it('rejects a clientMessageId with special characters', () => {
    const r = sendMessageSchema.safeParse({
      conversationId: '00000000-0000-0000-0000-000000000001',
      clientMessageId: 'has spaces and !',
      body: 'Hello',
    });
    assert.equal(r.success, false);
  });

  it('rejects a clientMessageId that is too short (< 8 chars)', () => {
    const r = sendMessageSchema.safeParse({
      conversationId: '00000000-0000-0000-0000-000000000001',
      clientMessageId: 'short',
      body: 'Hello',
    });
    assert.equal(r.success, false);
  });

  it('rejects an invalid message type', () => {
    const r = sendMessageSchema.safeParse({
      conversationId: '00000000-0000-0000-0000-000000000001',
      clientMessageId: 'web-1234567890-abc123',
      type: 'INVALID',
      body: 'Hello',
    });
    assert.equal(r.success, false);
  });

  it('rejects a body that exceeds 10 000 chars', () => {
    const r = sendMessageSchema.safeParse({
      conversationId: '00000000-0000-0000-0000-000000000001',
      clientMessageId: 'web-1234567890-abc123',
      body: 'x'.repeat(10_001),
    });
    assert.equal(r.success, false);
  });
});

describe('editMessageSchema', () => {
  it('accepts a non-empty body', () => {
    const r = editMessageSchema.safeParse({ body: 'Edited text' });
    assert.ok(r.success);
  });

  it('rejects an empty body', () => {
    const r = editMessageSchema.safeParse({ body: '' });
    assert.equal(r.success, false);
  });
});

describe('reactSchema', () => {
  it('accepts a single emoji', () => {
    const r = reactSchema.safeParse({ emoji: '👍' });
    assert.ok(r.success);
  });

  it('rejects an empty emoji', () => {
    const r = reactSchema.safeParse({ emoji: '' });
    assert.equal(r.success, false);
  });

  it('rejects an emoji string that is too long', () => {
    const r = reactSchema.safeParse({ emoji: '😀'.repeat(6) });
    assert.equal(r.success, false);
  });
});

describe('markReadSchema', () => {
  it('accepts a valid UUID', () => {
    const r = markReadSchema.safeParse({
      lastReadMessageId: '00000000-0000-0000-0000-000000000001',
    });
    assert.ok(r.success);
  });
});

describe('searchMessagesSchema', () => {
  it('accepts a valid search query', () => {
    const r = searchMessagesSchema.safeParse({ q: 'hello' });
    assert.ok(r.success);
  });

  it('coerces page/pageSize from strings', () => {
    const r = searchMessagesSchema.safeParse({ q: 'test', page: '3', pageSize: '10' });
    assert.ok(r.success);
    if (r.success) {
      assert.equal(r.data.page, 3);
      assert.equal(r.data.pageSize, 10);
    }
  });

  it('rejects a query shorter than 2 chars', () => {
    const r = searchMessagesSchema.safeParse({ q: 'a' });
    assert.equal(r.success, false);
  });
});

describe('listConversationsSchema', () => {
  it('defaults page and pageSize', () => {
    const r = listConversationsSchema.safeParse({});
    assert.ok(r.success);
    if (r.success) {
      assert.equal(r.data.page, 1);
      assert.equal(r.data.pageSize, 50);
    }
  });
});

describe('listMessagesSchema', () => {
  it('accepts a before cursor and limit', () => {
    const r = listMessagesSchema.safeParse({
      before: '00000000-0000-0000-0000-000000000001',
      limit: 50,
    });
    assert.ok(r.success);
  });

  it('defaults limit to 50', () => {
    const r = listMessagesSchema.safeParse({});
    assert.ok(r.success);
    if (r.success) assert.equal(r.data.limit, 50);
  });

  it('rejects a limit greater than 100', () => {
    const r = listMessagesSchema.safeParse({ limit: 200 });
    assert.equal(r.success, false);
  });
});
