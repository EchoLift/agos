import { Injectable } from '@nestjs/common';
import { PrismaService } from '@packages/database/prisma.service';
import { User, Prisma } from '@prisma/client';

@Injectable()
export class UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createUser(data: Prisma.UserUncheckedCreateInput): Promise<User> {
    return this.prisma.user.create({ data });
  }

  async upsertByAuthUserId(
    authUserId: string,
    data: Omit<Prisma.UserUncheckedCreateInput, 'authUserId'> = {},
  ): Promise<User> {
    return this.prisma.user.upsert({
      where: { authUserId },
      update: data,
      create: { authUserId, ...data },
    });
  }

  async findByAuthUserId(authUserId: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { authUserId },
    });
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }
}
