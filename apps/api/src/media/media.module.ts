import { Global, Module } from '@nestjs/common';
import { StorageService } from './storage.service';
import { MediaService } from './media.service';
import { MediaController } from './media.controller';

@Global()
@Module({
  providers: [StorageService, MediaService],
  controllers: [MediaController],
  exports: [StorageService, MediaService],
})
export class MediaModule {}
