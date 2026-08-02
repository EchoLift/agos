import { Module } from "@nestjs/common";
import { AuthController } from "./controllers/auth.controller";
import { AuthService } from "./services/auth.service";
import { SessionService } from "./services/session.service";
import { CryptoService } from "./services/crypto.service";
import { PasswordService } from "./services/password.service";
import { TokenService } from "./services/token.service";
import { InvitationClaimService } from "./services/invitation-claim.service";
import { AuthUserRepository } from "./repositories/auth-user.repository";
import { UserModule } from "@modules/user/user.module";

@Module({
  imports: [UserModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    SessionService,
    CryptoService,
    PasswordService,
    TokenService,
    InvitationClaimService,
    AuthUserRepository,
  ],
  exports: [TokenService, CryptoService, AuthUserRepository],
})
export class AuthModule {}
