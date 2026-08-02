import { Injectable } from "@nestjs/common";
import { UserRepository } from "../repositories/user.repository";
import { User } from "@prisma/client";

@Injectable()
export class UserLookupService {
  constructor(private readonly userRepository: UserRepository) {}

  async findByAuthUserId(authUserId: string): Promise<User | null> {
    return this.userRepository.findByAuthUserId(authUserId);
  }

  async findById(userId: string): Promise<User | null> {
    return this.userRepository.findById(userId);
  }
}
