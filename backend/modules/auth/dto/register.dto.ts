import { IntersectionType } from '@nestjs/mapped-types';
import { EmailDto } from './email.dto';
import { PasswordDto } from './password.dto';

export class RegisterDto extends IntersectionType(EmailDto, PasswordDto) {}
