import { Body, Controller, Post } from "@nestjs/common";
import { CurrentUser } from "@packages/security/decorators/current-user.decorator";
import { IdentityContext } from "@packages/security/interfaces/identity-context.interface";
import { AttachExternalFileDto } from "./dto/attach-external-file.dto";
import { FileService } from "./file.service";

@Controller({ path: "files", version: "1" })
export class FileController {
  constructor(private readonly fileService: FileService) {}

  @Post("external-links")
  attachExternalLink(
    @Body() dto: AttachExternalFileDto,
    @CurrentUser() user: IdentityContext,
  ) {
    return this.fileService.attachExternalLink(dto, user);
  }
}
