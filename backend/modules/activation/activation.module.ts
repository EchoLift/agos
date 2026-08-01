import { Module } from '@nestjs/common';
import { DatabaseModule } from '@packages/database/database.module';
import { ActivationController } from './activation.controller';
import { ActivationService } from './activation.service';

@Module({
  imports: [DatabaseModule],
  controllers: [ActivationController],
  providers: [ActivationService],
})
export class ActivationModule {}
