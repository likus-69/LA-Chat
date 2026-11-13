import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from './storage.service';
import { MediaAssetDto, MediaCategory } from '@la-chat/shared-types';
import { uploadInitSchema } from '@la-chat/validation';
import type { Prisma } from '@prisma/client';

export interface UploadInitResult {
  asset: MediaAssetDto;
  uploadUrl: string;
}

@Injectable()
export class MediaService {
  private readonly logger = new Logger('MediaService');

  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
  ) {}

  async initUpload(ownerId: string, input: unknown): Promise<UploadInitResult> {
    const parsed = uploadInitSchema.safeParse(input);
    if (!parsed.success) {
      throw new BadRequestException({
        message: 'Upload validation failed',
        issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
    }
    const { filename, mimeType, category, sizeBytes } = parsed.data;

    const assetId = randomUUID();
    const safeFilename = filename.replace(/[^A-Za-z0-9._-]/g, '_');
    const storageKey = `media/${ownerId}/${assetId}/${safeFilename}`;

    const asset = await this.prisma.mediaAsset.create({
      data: {
        id: assetId,
        ownerId,
        category,
        filename,
        mimeType,
        sizeBytes,
        storageKey,
        status: 'UPLOADING',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    const uploadUrl = await this.generateSignedPutUrl(storageKey, mimeType);

    return {
      asset: this.toDto(asset, null),
      uploadUrl,
    };
  }

  async confirmUpload(ownerId: string, assetId: string): Promise<MediaAssetDto> {
    const asset = await this.prisma.mediaAsset.findUnique({ where: { id: assetId } });
    if (!asset) throw new NotFoundException('Media asset not found');
    if (asset.ownerId !== ownerId) throw new ForbiddenException('You do not own this asset');
    if (asset.status === 'ATTACHED') throw new BadRequestException('Asset already attached to a message');

    const signedUrl = await this.storage.getSignedDownloadUrl(asset.storageKey);

    const updated = await this.prisma.mediaAsset.update({
      where: { id: assetId },
      data: { status: 'READY', expiresAt: null },
    });

    return this.toDto(updated, signedUrl);
  }

  async getDownloadUrl(callerId: string, assetId: string): Promise<MediaAssetDto> {
    const asset = await this.prisma.mediaAsset.findUnique({ where: { id: assetId } });
    if (!asset) throw new NotFoundException('Media asset not found');

    const isOwner = asset.ownerId === callerId;
    const isParticipant = await this.isAttachmentParticipant(callerId, asset.id);
    if (!isOwner && !isParticipant) {
      throw new ForbiddenException('You do not have access to this file');
    }

    const signedUrl = await this.storage.getSignedDownloadUrl(asset.storageKey);
    return this.toDto(asset, signedUrl);
  }

  async attachToMessage(
    senderId: string,
    messageId: string,
    assetIds: string[],
  ): Promise<void> {
    if (assetIds.length === 0) return;

    const assets = await this.prisma.mediaAsset.findMany({
      where: { id: { in: assetIds } },
    });

    for (const asset of assets) {
      if (asset.ownerId !== senderId) {
        throw new ForbiddenException(`You do not own asset ${asset.id}`);
      }
      if (asset.status !== 'READY') {
        throw new BadRequestException(`Asset ${asset.id} is not ready (status: ${asset.status})`);
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.messageAttachment.createMany({
        data: assets.map((a) => ({
          messageId,
          storageKey: a.storageKey,
          filename: a.filename,
          mimeType: a.mimeType,
          sizeBytes: a.sizeBytes,
          widthPx: a.widthPx,
          heightPx: a.heightPx,
          durationSec: a.durationSec,
        })),
      });
      await tx.mediaAsset.updateMany({
        where: { id: { in: assetIds } },
        data: { status: 'ATTACHED', expiresAt: null },
      });
    });
  }

  async cleanupOrphanedUploads(): Promise<number> {
    const result = await this.prisma.mediaAsset.deleteMany({
      where: {
        status: 'UPLOADING',
        expiresAt: { lt: new Date() },
      },
    });
    if (result.count > 0) {
      this.logger.log(`Cleaned up ${result.count} orphaned uploads`);
    }
    return result.count;
  }

  private async generateSignedPutUrl(storageKey: string, mimeType: string): Promise<string> {
    const { PutObjectCommand } = await import('@aws-sdk/client-s3');
    const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
    const cmd = new PutObjectCommand({
      Bucket: this.storage.bucketName,
      Key: storageKey,
      ContentType: mimeType,
      ContentDisposition: 'attachment',
    });
    return getSignedUrl(this.storage.s3Client, cmd, { expiresIn: 300 });
  }

  private async isAttachmentParticipant(userId: string, assetId: string): Promise<boolean> {
    const asset = await this.prisma.mediaAsset.findUnique({ where: { id: assetId } });
    if (!asset) return false;

    const msgWithAttachment = await this.prisma.messageAttachment.findFirst({
      where: { storageKey: asset.storageKey },
      include: { message: { include: { conversation: { include: { participants: true } } } } },
    });
    if (!msgWithAttachment) return false;

    return msgWithAttachment.message.conversation.participants.some(
      (p) => p.userId === userId && !p.leftAt,
    );
  }

  private toDto(
    asset: {
      id: string;
      ownerId: string;
      category: string;
      filename: string;
      mimeType: string;
      sizeBytes: number;
      storageKey: string;
      widthPx: number | null;
      heightPx: number | null;
      durationSec: number | null;
      status: string;
      createdAt: Date;
    },
    signedUrl: string | null,
  ): MediaAssetDto {
    return {
      id: asset.id,
      ownerId: asset.ownerId,
      category: asset.category as MediaCategory,
      filename: asset.filename,
      mimeType: asset.mimeType,
      sizeBytes: asset.sizeBytes,
      storageKey: asset.storageKey,
      widthPx: asset.widthPx,
      heightPx: asset.heightPx,
      durationSec: asset.durationSec,
      signedUrl,
      signedUrlTtlSec: this.storage.ttlSeconds,
      createdAt: asset.createdAt.toISOString(),
    };
  }
}
