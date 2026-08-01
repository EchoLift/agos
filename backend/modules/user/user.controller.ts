import { Controller, Get, Param } from '@nestjs/common';
import { UserService } from './services/user.service';

@Controller({ path: 'users', version: '1' })
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.userService.findById(id);
  }
}
