import { Module } from '@nestjs/common';
import { ConfigValidationService } from './config-validation.service';

@Module({
  providers: [ConfigValidationService]
})
export class ConfigValidationModule {}

