import { PartialType } from "@nestjs/swagger";
import { IsEnum, IsOptional } from "class-validator";
import { ClientContactStatus } from "@prisma/client";
import { CreateClientContactDto } from "./create-client-contact.dto";

export class UpdateClientContactDto extends PartialType(
  CreateClientContactDto,
) {
  @IsOptional()
  @IsEnum(ClientContactStatus)
  status?: ClientContactStatus;
}
