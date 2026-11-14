import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createReportSchema, takeModerationActionSchema, listAuditLogsSchema, reportCategorySchema, moderationActionTypeSchema } from '@la-chat/validation';

describe('createReportSchema', () => {
  it('accepts a message report', () => {
    const r = createReportSchema.safeParse({ reportedMessageId: '00000000-0000-0000-0000-000000000001', category: 'BULLYING', reason: 'Offensive language in the chat' });
    assert.ok(r.success);
  });
  it('accepts a user report', () => {
    const r = createReportSchema.safeParse({ reportedUserId: '00000000-0000-0000-0000-000000000002', category: 'IMPERSONATION', reason: 'Pretending to be a teacher' });
    assert.ok(r.success);
  });
  it('rejects a report with no target', () => {
    const r = createReportSchema.safeParse({ category: 'SPAM', reason: 'Some reason' });
    assert.equal(r.success, false);
  });
  it('rejects a reason shorter than 3 chars', () => {
    const r = createReportSchema.safeParse({ reportedMessageId: '00000000-0000-0000-0000-000000000001', category: 'SPAM', reason: 'AB' });
    assert.equal(r.success, false);
  });
  it('rejects an invalid category', () => {
    const r = createReportSchema.safeParse({ reportedMessageId: '00000000-0000-0000-0000-000000000001', category: 'HARASSMENT', reason: 'Some reason' });
    assert.equal(r.success, false);
  });
});

describe('takeModerationActionSchema', () => {
  it('accepts WARN', () => {
    const r = takeModerationActionSchema.safeParse({ action: 'WARN', note: 'First warning' });
    assert.ok(r.success);
  });
  it('accepts REMOVE_MESSAGE', () => {
    const r = takeModerationActionSchema.safeParse({ action: 'REMOVE_MESSAGE' });
    assert.ok(r.success);
  });
  it('accepts SUSPEND_ACCOUNT', () => {
    const r = takeModerationActionSchema.safeParse({ action: 'SUSPEND_ACCOUNT', note: 'Repeated violations' });
    assert.ok(r.success);
  });
  it('accepts DISMISS', () => {
    const r = takeModerationActionSchema.safeParse({ action: 'DISMISS' });
    assert.ok(r.success);
  });
  it('rejects an invalid action', () => {
    const r = takeModerationActionSchema.safeParse({ action: 'BAN' });
    assert.equal(r.success, false);
  });
});

describe('listAuditLogsSchema', () => {
  it('accepts empty params (defaults)', () => {
    const r = listAuditLogsSchema.safeParse({});
    assert.ok(r.success);
    if (r.success) { assert.equal(r.data.page, 1); assert.equal(r.data.pageSize, 50); }
  });
  it('coerces page/pageSize from strings', () => {
    const r = listAuditLogsSchema.safeParse({ page: '3', pageSize: '25' });
    assert.ok(r.success);
    if (r.success) { assert.equal(r.data.page, 3); assert.equal(r.data.pageSize, 25); }
  });
  it('rejects pageSize > 100', () => {
    const r = listAuditLogsSchema.safeParse({ pageSize: 200 });
    assert.equal(r.success, false);
  });
});

describe('moderation enum schemas', () => {
  it('reportCategorySchema accepts valid values', () => {
    assert.ok(reportCategorySchema.safeParse('BULLYING').success);
    assert.ok(reportCategorySchema.safeParse('THREAT').success);
    assert.ok(!reportCategorySchema.safeParse('HARASSMENT').success);
  });
  it('moderationActionTypeSchema accepts valid values', () => {
    assert.ok(moderationActionTypeSchema.safeParse('WARN').success);
    assert.ok(moderationActionTypeSchema.safeParse('SUSPEND_ACCOUNT').success);
    assert.ok(!moderationActionTypeSchema.safeParse('BAN').success);
  });
});
