import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
} from "class-validator";
import { ClientContactRole, ContactMethod } from "@prisma/client";

export class CreateClientContactDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  designation?: string | null;

  @IsOptional()
  @IsString()
  email?: string | null;

  @IsOptional()
  @IsString()
  phone?: string | null;

  @IsOptional()
  @IsString()
  whatsapp?: string | null;

  @IsOptional()
  @IsEnum(ClientContactRole)
  role?: ClientContactRole;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @IsOptional()
  @IsEnum(ContactMethod)
  preferredContactMethod?: ContactMethod | null;

  @IsOptional()
  @IsUUID()
  userId?: string | null;
}
