import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from './notifications.service';
import type { NotificationType } from '@la-chat/shared-types';

@Injectable()
export class PushService {
  private readonly logger = new Logger('PushService');
  private readonly fcmProjectId: string | null;
  private readonly apnsTeamId: string | null;

  constructor(
    private config: ConfigService,
    private notifications: NotificationsService,
  ) {
    this.fcmProjectId = this.config.get<string>('FCM_PROJECT_ID') || null;
    this.apnsTeamId = this.config.get<string>('APNS_TEAM_ID') || null;
  }

  get isConfigured(): boolean {
    return this.fcmProjectId !== null || this.apnsTeamId !== null;
  }

  async sendToUser(
    userId: string,
    type: NotificationType,
    title: string,
    body: string,
    data?: Record<string, unknown>,
  ): Promise<number> {
    if (!this.isConfigured) {
      this.logger.debug(`Push not configured — skipping ${type} to ${userId}`);
      return 0;
    }

    const prefs = await this.notifications.getPreferences(userId);
    if (!prefs.enabled) return 0;
    const typePref = prefs.perType[type];
    if (typePref && !typePref.push) return 0;

    if (this.isInQuietHours(prefs.quietHoursStart, prefs.quietHoursEnd)) {
      this.logger.debug(`Quiet hours — suppressing push to ${userId}`);
      return 0;
    }

    const tokens = await this.notifications.getPushTokens(userId);
    if (tokens.length === 0) return 0;

    let delivered = 0;
    for (const { platform, token } of tokens) {
      try {
        if (platform === 'ANDROID' || platform === 'WEB') {
          await this.sendFcm(token, title, body, data);
        } else if (platform === 'IOS') {
          await this.sendApns(token, title, body, data);
        }
        delivered++;
      } catch (e) {
        this.logger.warn(`Push to ${platform} failed: ${(e as Error).message}`);
      }
    }
    return delivered;
  }

  private async sendFcm(token: string, title: string, body: string, data?: Record<string, unknown>): Promise<void> {
    if (!this.fcmProjectId) return;
    const serverKey = this.config.get<string>('FCM_SERVER_KEY');
    if (!serverKey) {
      this.logger.debug('FCM_SERVER_KEY not set — skipping FCM send');
      return;
    }
    const res = await fetch('https://fcm.googleapis.com/fcm/send', {
      method: 'POST',
      headers: { Authorization: `key=${serverKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: token,
        notification: { title, body },
        data: data ?? {},
        android: { priority: 'high' },
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`FCM HTTP ${res.status}: ${text}`);
    }
  }

  private async sendApns(token: string, title: string, body: string, data?: Record<string, unknown>): Promise<void> {
    if (!this.apnsTeamId) return;
    const keyPath = this.config.get<string>('APNS_PRIVATE_KEY_PATH');
    const keyId = this.config.get<string>('APNS_KEY_ID');
    if (!keyPath || !keyId) {
      this.logger.debug('APNs credentials not fully set — skipping APNs send');
      return;
    }
    this.logger.log(`[APNs] would send to ${token.slice(0, 8)}…: ${title}`);
  }

  private isInQuietHours(start: string | null, end: string | null): boolean {
    if (!start || !end) return false;
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    const startMin = sh * 60 + sm;
    const endMin = eh * 60 + em;
    if (startMin <= endMin) {
      return nowMin >= startMin && nowMin < endMin;
    }
    return nowMin >= startMin || nowMin < endMin;
  }
}
