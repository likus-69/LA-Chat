import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { CsvImportService } from './csv-import.service';

@Module({
  providers: [UsersService, CsvImportService],
  controllers: [UsersController],
  exports: [UsersService, CsvImportService],
})
export class UsersModule {}
