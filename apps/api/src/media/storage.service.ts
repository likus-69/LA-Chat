import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger('StorageService');
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly signedUrlTtlSec = 300;

  constructor(private config: ConfigService) {
    const endpoint = this.config.get<string>('S3_ENDPOINT', 'http://127.0.0.1:9000');
    const region = this.config.get<string>('S3_REGION', 'us-east-1');
    const accessKeyId = this.config.get<string>('S3_ACCESS_KEY_ID', 'la_chat_minio');
    const secretAccessKey = this.config.get<string>('S3_SECRET_ACCESS_KEY', 'change_me_in_prod');
    const forcePathStyle = this.config.get<string>('S3_FORCE_PATH_STYLE', 'true') === 'true';

    this.client = new S3Client({
      endpoint,
      region,
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle,
    });
    this.bucket = this.config.get<string>('S3_BUCKET', 'la-chat-media');
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      this.logger.log(`Bucket "${this.bucket}" exists`);
    } catch {
      try {
        await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
        this.logger.log(`Created bucket "${this.bucket}"`);
      } catch (e) {
        this.logger.warn(`Could not verify/create bucket: ${(e as Error).message}`);
      }
    }
  }

  async putObject(storageKey: string, body: Buffer, mimeType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: storageKey,
        Body: body,
        ContentType: mimeType,
        ContentDisposition: 'attachment',
      }),
    );
  }

  async getSignedDownloadUrl(storageKey: string): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: storageKey }),
      { expiresIn: this.signedUrlTtlSec },
    );
  }

  async deleteObject(storageKey: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: storageKey }),
    );
  }

  get ttlSeconds(): number {
    return this.signedUrlTtlSec;
  }

  get s3Client(): S3Client {
    return this.client;
  }

  get bucketName(): string {
    return this.bucket;
  }
}
