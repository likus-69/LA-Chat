import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createAnnouncementSchema, createGroupSchema, addGroupMemberSchema, announcementCategorySchema, announcementPrioritySchema, announcementAudienceSchema, groupTypeSchema } from '@la-chat/validation';

describe('createAnnouncementSchema', () => {
  it('accepts a valid school-wide announcement', () => {
    const r = createAnnouncementSchema.safeParse({ category: 'SCHOOL_WIDE', priority: 'NORMAL', audience: 'ALL', title: 'School closes for holidays', body: 'The school will close on 15 December.' });
    assert.ok(r.success);
  });
  it('accepts a class announcement with targetClassId', () => {
    const r = createAnnouncementSchema.safeParse({ category: 'CLASS', audience: 'CLASS', title: 'S1 Maths test', body: 'Reminder: Maths test on Friday.', targetClassId: '00000000-0000-0000-0000-000000000001' });
    assert.ok(r.success);
  });
  it('rejects a CLASS announcement without targetClassId', () => {
    const r = createAnnouncementSchema.safeParse({ category: 'CLASS', audience: 'CLASS', title: 'Test', body: 'Body' });
    assert.equal(r.success, false);
  });
  it('rejects a STREAM announcement without targetStreamId', () => {
    const r = createAnnouncementSchema.safeParse({ category: 'STREAM', audience: 'STREAM', title: 'Test', body: 'Body' });
    assert.equal(r.success, false);
  });
  it('rejects a title shorter than 2 chars', () => {
    const r = createAnnouncementSchema.safeParse({ category: 'SCHOOL_WIDE', audience: 'ALL', title: 'A', body: 'Body' });
    assert.equal(r.success, false);
  });
  it('defaults priority to NORMAL', () => {
    const r = createAnnouncementSchema.safeParse({ category: 'SCHOOL_WIDE', audience: 'ALL', title: 'Test', body: 'Body' });
    assert.ok(r.success); if (r.success) assert.equal(r.data.priority, 'NORMAL');
  });
  it('rejects an invalid category', () => {
    const r = createAnnouncementSchema.safeParse({ category: 'INVALID', audience: 'ALL', title: 'Test', body: 'Body' });
    assert.equal(r.success, false);
  });
});

describe('createGroupSchema', () => {
  it('accepts a CLASS group with classId', () => {
    const r = createGroupSchema.safeParse({ type: 'CLASS', name: 'S1 Class Group', classId: '00000000-0000-0000-0000-000000000001' });
    assert.ok(r.success);
  });
  it('accepts a STREAM group with streamId', () => {
    const r = createGroupSchema.safeParse({ type: 'STREAM', name: 'S1 East Stream', streamId: '00000000-0000-0000-0000-000000000002' });
    assert.ok(r.success);
  });
  it('accepts a CLUB group', () => {
    const r = createGroupSchema.safeParse({ type: 'CLUB', name: 'Debate Club', memberUserIds: ['00000000-0000-0000-0000-000000000001'] });
    assert.ok(r.success);
  });
  it('rejects a CLASS group without classId', () => {
    const r = createGroupSchema.safeParse({ type: 'CLASS', name: 'Missing class' });
    assert.equal(r.success, false);
  });
  it('rejects a STREAM group without streamId', () => {
    const r = createGroupSchema.safeParse({ type: 'STREAM', name: 'Missing stream' });
    assert.equal(r.success, false);
  });
  it('rejects a SUBJECT group without subjectId', () => {
    const r = createGroupSchema.safeParse({ type: 'SUBJECT', name: 'Missing subject' });
    assert.equal(r.success, false);
  });
});

describe('addGroupMemberSchema', () => {
  it('accepts a valid member addition', () => {
    const r = addGroupMemberSchema.safeParse({ userId: '00000000-0000-0000-0000-000000000001', role: 'MEMBER' });
    assert.ok(r.success);
  });
  it('defaults role to MEMBER', () => {
    const r = addGroupMemberSchema.safeParse({ userId: '00000000-0000-0000-0000-000000000001' });
    assert.ok(r.success); if (r.success) assert.equal(r.data.role, 'MEMBER');
  });
  it('rejects an invalid role', () => {
    const r = addGroupMemberSchema.safeParse({ userId: '00000000-0000-0000-0000-000000000001', role: 'OWNER' });
    assert.equal(r.success, false);
  });
});

describe('announcement enum schemas', () => {
  it('category schema works', () => {
    assert.ok(announcementCategorySchema.safeParse('SCHOOL_WIDE').success);
    assert.ok(!announcementCategorySchema.safeParse('INVALID').success);
  });
  it('priority schema works', () => {
    assert.ok(announcementPrioritySchema.safeParse('CRITICAL').success);
    assert.ok(!announcementPrioritySchema.safeParse('URGENT').success);
  });
  it('audience schema works', () => {
    assert.ok(announcementAudienceSchema.safeParse('ALL').success);
    assert.ok(!announcementAudienceSchema.safeParse('EVERYONE').success);
  });
  it('groupType schema works', () => {
    assert.ok(groupTypeSchema.safeParse('CLASS').success);
    assert.ok(!groupTypeSchema.safeParse('TEAM').success);
  });
});
