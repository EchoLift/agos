import { IsEmail, IsNotEmpty } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class EmailDto {
  @IsEmail({}, { message: "Invalid email format" })
  @IsNotEmpty()
  @ApiProperty({
    example: "user@example.com",
    description: "User email address",
  })
  email!: string;
}
