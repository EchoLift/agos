import { Module } from "@nestjs/common";
import { ClientController } from "./client.controller";
import { ClientService } from "./client.service";
import { ClientContactService } from "./client-contact.service";
import { AuthModule } from "@modules/auth/auth.module";
import { UserModule } from "@modules/user/user.module";

@Module({
  imports: [AuthModule, UserModule],
  controllers: [ClientController],
  providers: [ClientService, ClientContactService],
  exports: [ClientService, ClientContactService],
})
export class ClientModule {}
