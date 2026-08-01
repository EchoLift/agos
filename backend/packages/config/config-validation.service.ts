import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const requiredEnvironmentVariables = [
  'DATABASE_URL',
  'REDIS_URL',
  'RABBITMQ_URL',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'FIELD_ENCRYPTION_KEY_BASE64',
  'FIELD_LOOKUP_SECRET',
  'GOOGLE_CLIENT_ID',
];

@Injectable()
export class ConfigValidationService implements OnModuleInit {
  private readonly logger = new Logger(ConfigValidationService.name);

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const missing = requiredEnvironmentVariables.filter((key) => !this.config.get<string>(key));

    if (missing.length > 0) {
      this.logger.warn(`Missing environment variables: ${missing.join(', ')}`);
    }
  }
}
