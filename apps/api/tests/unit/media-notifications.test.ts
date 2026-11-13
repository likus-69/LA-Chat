import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  uploadInitSchema,
  registerPushTokenSchema,
  updateNotificationPreferencesSchema,
  MEDIA_LIMITS,
  FORBIDDEN_MIME_TYPES,
} from '@la-chat/validation';

describe('uploadInitSchema', () => {
  it('accepts a valid image upload', () => {
    const r = uploadInitSchema.safeParse({ filename: 'photo.jpg', mimeType: 'image/jpeg', category: 'image', sizeBytes: 1024 * 1024 });
    assert.ok(r.success);
  });

  it('accepts a valid PDF document', () => {
    const r = uploadInitSchema.safeParse({ filename: 'homework.pdf', mimeType: 'application/pdf', category: 'document', sizeBytes: 5 * 1024 * 1024 });
    assert.ok(r.success);
  });

  it('accepts a voice message', () => {
    const r = uploadInitSchema.safeParse({ filename: 'voice.webm', mimeType: 'audio/webm', category: 'voice', sizeBytes: 500 * 1024 });
    assert.ok(r.success);
  });

  it('rejects an image exceeding 10MB', () => {
    const r = uploadInitSchema.safeParse({ filename: 'big.png', mimeType: 'image/png', category: 'image', sizeBytes: 11 * 1024 * 1024 });
    assert.equal(r.success, false);
  });

  it('rejects a video exceeding 100MB', () => {
    const r = uploadInitSchema.safeParse({ filename: 'video.mp4', mimeType: 'video/mp4', category: 'video', sizeBytes: 101 * 1024 * 1024 });
    assert.equal(r.success, false);
  });

  it('rejects an executable file', () => {
    const r = uploadInitSchema.safeParse({ filename: 'malware.exe', mimeType: 'application/x-executable', category: 'document', sizeBytes: 1024 });
    assert.equal(r.success, false);
  });

  it('rejects text/html (XSS risk)', () => {
    const r = uploadInitSchema.safeParse({ filename: 'page.html', mimeType: 'text/html', category: 'document', sizeBytes: 1024 });
    assert.equal(r.success, false);
  });

  it('rejects a MIME type that does not match the category', () => {
    const r = uploadInitSchema.safeParse({ filename: 'fake.jpg', mimeType: 'application/pdf', category: 'image', sizeBytes: 1024 });
    assert.equal(r.success, false);
  });
});

describe('MEDIA_LIMITS', () => {
  it('defines limits for all 5 categories', () => {
    assert.ok(MEDIA_LIMITS.image);
    assert.ok(MEDIA_LIMITS.document);
    assert.ok(MEDIA_LIMITS.voice);
    assert.ok(MEDIA_LIMITS.video);
    assert.ok(MEDIA_LIMITS.audio);
  });

  it('image limit is 10MB', () => {
    assert.equal(MEDIA_LIMITS.image.maxBytes, 10 * 1024 * 1024);
  });

  it('video limit is 100MB', () => {
    assert.equal(MEDIA_LIMITS.video.maxBytes, 100 * 1024 * 1024);
  });
});

describe('FORBIDDEN_MIME_TYPES', () => {
  it('includes executable types', () => {
    assert.ok(FORBIDDEN_MIME_TYPES.has('application/x-executable'));
    assert.ok(FORBIDDEN_MIME_TYPES.has('application/x-msdownload'));
    assert.ok(FORBIDDEN_MIME_TYPES.has('application/octet-stream'));
  });

  it('includes text/html', () => {
    assert.ok(FORBIDDEN_MIME_TYPES.has('text/html'));
  });
});

describe('registerPushTokenSchema', () => {
  it('accepts a valid Android token', () => {
    const r = registerPushTokenSchema.safeParse({ platform: 'ANDROID', token: 'firebase-token-string-at-least-10-chars' });
    assert.ok(r.success);
  });

  it('accepts a valid iOS token', () => {
    const r = registerPushTokenSchema.safeParse({ platform: 'IOS', token: 'apns-device-token-hex-string' });
    assert.ok(r.success);
  });

  it('rejects an invalid platform', () => {
    const r = registerPushTokenSchema.safeParse({ platform: 'WINDOWS_PHONE', token: 'some-token-string' });
    assert.equal(r.success, false);
  });

  it('rejects a token shorter than 10 chars', () => {
    const r = registerPushTokenSchema.safeParse({ platform: 'ANDROID', token: 'short' });
    assert.equal(r.success, false);
  });
});

describe('updateNotificationPreferencesSchema', () => {
  it('accepts a simple enable/disable', () => {
    const r = updateNotificationPreferencesSchema.safeParse({ enabled: false });
    assert.ok(r.success);
  });

  it('accepts quiet hours', () => {
    const r = updateNotificationPreferencesSchema.safeParse({ enabled: true, quietHoursStart: '22:00', quietHoursEnd: '06:00' });
    assert.ok(r.success);
  });

  it('rejects an invalid quiet hours time', () => {
    const r = updateNotificationPreferencesSchema.safeParse({ enabled: true, quietHoursStart: '25:00' });
    assert.equal(r.success, false);
  });

  it('accepts per-type preferences', () => {
    const r = updateNotificationPreferencesSchema.safeParse({
      enabled: true,
      perType: {
        'message.new': { inApp: true, push: false },
        'announcement.new': { inApp: true, push: true },
      },
    });
    assert.ok(r.success);
  });
});
