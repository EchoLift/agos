import { IsNotEmpty, IsString } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class GoogleOAuthDto {
  @ApiProperty({
    example: "eyJhbGciOiJSUzI1...",
    description: "Google ID Token from client SDK",
  })
  @IsString()
  @IsNotEmpty()
  token!: string;
}
