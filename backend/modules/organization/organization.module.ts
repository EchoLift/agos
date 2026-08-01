import { Module } from '@nestjs/common';
import { DatabaseModule } from '@packages/database/database.module';
import { RequestContextModule } from '@packages/request-context/request-context.module';
import { UserModule } from '../user/user.module';
import { AuthModule } from '../auth/auth.module';
import { OrganizationController } from './controllers/organization.controller';
import { OrganizationService } from './services/organization.service';
import { OrganizationRepository } from './repositories/organization.repository';

@Module({
  imports: [DatabaseModule, RequestContextModule, UserModule, AuthModule],
  controllers: [OrganizationController],
  providers: [OrganizationService, OrganizationRepository],
  exports: [OrganizationService, OrganizationRepository],
})
export class OrganizationModule {}
