import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { UserRepository } from "../repositories/user.repository";
import { PresenceStatus, User } from "@prisma/client";
import { PrismaService } from "@packages/database/prisma.service";
import { UpdateProfileDto } from "../dto/update-profile.dto";
import { UpdateStatusDto } from "../dto/update-status.dto";
import * as crypto from "crypto";

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    private readonly userRepository: UserRepository,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async provisionUser(
    authUserId: string,
    profile?: { name?: string | null; avatarUrl?: string | null },
  ): Promise<User> {
    try {
      const user = await this.userRepository.upsertByAuthUserId(authUserId, {
        name: profile?.name ?? undefined,
        avatarUrl: profile?.avatarUrl ?? undefined,
      });
      this.logger.log(`Provisioned user profile for authUserId: ${authUserId}`);
      return user;
    } catch (error: any) {
      if (error.code === "P2002") {
        this.logger.warn(
          `User profile already exists for authUserId: ${authUserId}`,
        );
        const existing = await this.userRepository.findByAuthUserId(authUserId);
        if (existing) return existing;
      }
      throw error;
    }
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    return user;
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { authUser: { select: { emailEncrypted: true } } },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    return this.toProfileResponse(user);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    await this.ensureUser(userId);

    const mobileNumber = this.nullIfBlank(dto.mobileNumber);
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.name !== undefined ? { name: this.nullIfBlank(dto.name) } : {}),
        ...(dto.avatarUrl !== undefined
          ? { avatarUrl: this.nullIfBlank(dto.avatarUrl) }
          : {}),
        ...(dto.mobileNumber !== undefined
          ? {
              mobileNumberEncrypted: mobileNumber
                ? this.encrypt(mobileNumber)
                : null,
              mobileNumberHash: mobileNumber
                ? this.hashLookup(mobileNumber)
                : null,
            }
          : {}),
        ...(dto.timezone !== undefined
          ? { timezone: this.nullIfBlank(dto.timezone) }
          : {}),
        ...(dto.language !== undefined
          ? { language: this.nullIfBlank(dto.language) }
          : {}),
        ...(dto.jobTitle !== undefined
          ? { jobTitle: this.nullIfBlank(dto.jobTitle) }
          : {}),
        ...(dto.bio !== undefined ? { bio: this.nullIfBlank(dto.bio) } : {}),
        version: { increment: 1 },
      },
      include: { authUser: { select: { emailEncrypted: true } } },
    });

    return this.toProfileResponse(user);
  }

  async updateStatus(userId: string, dto: UpdateStatusDto) {
    await this.ensureUser(userId);

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        presenceStatus: dto.status,
        workLocation: dto.location ?? null,
        statusMessage: this.nullIfBlank(dto.message),
        statusExpiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        version: { increment: 1 },
      },
    });

    return {
      presenceStatus: user.presenceStatus,
      workLocation: user.workLocation,
      statusMessage: user.statusMessage,
      statusExpiresAt: user.statusExpiresAt,
    };
  }

  async clearStatus(userId: string) {
    await this.ensureUser(userId);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        presenceStatus: PresenceStatus.AVAILABLE,
        workLocation: null,
        statusMessage: null,
        statusExpiresAt: null,
        version: { increment: 1 },
      },
    });

    return {
      presenceStatus: PresenceStatus.AVAILABLE,
      workLocation: null,
      statusMessage: null,
      statusExpiresAt: null,
    };
  }

  private async ensureUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) {
      throw new NotFoundException("User not found");
    }
  }

  private toProfileResponse(
    user: User & { authUser?: { emailEncrypted: string } },
  ) {
    return {
      id: user.id,
      name: user.name,
      avatarUrl: user.avatarUrl,
      email: this.decryptOptional(user.authUser?.emailEncrypted),
      mobileNumber: this.decryptOptional(user.mobileNumberEncrypted),
      timezone: user.timezone,
      language: user.language,
      jobTitle: user.jobTitle,
      bio: user.bio,
      presenceStatus: user.presenceStatus,
      workLocation: user.workLocation,
      statusMessage: user.statusMessage,
      statusExpiresAt: user.statusExpiresAt,
      updatedAt: user.updatedAt,
    };
  }

  private nullIfBlank(value?: string | null) {
    if (value === undefined) return undefined;
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  }

  private encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const key = Buffer.from(this.encryptionSecret(), "hex");
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");
    const authTag = cipher.getAuthTag().toString("hex");
    return `${iv.toString("hex")}:${authTag}:${encrypted}`;
  }

  private decryptOptional(value?: string | null) {
    if (!value) return null;

    try {
      const [ivHex, authTagHex, encryptedData] = value.split(":");
      if (!ivHex || !authTagHex || !encryptedData) return null;
      const decipher = crypto.createDecipheriv(
        "aes-256-gcm",
        Buffer.from(this.encryptionSecret(), "hex"),
        Buffer.from(ivHex, "hex"),
      );
      decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
      let decrypted = decipher.update(encryptedData, "hex", "utf8");
      decrypted += decipher.final("utf8");
      return decrypted;
    } catch {
      return null;
    }
  }

  private hashLookup(text: string): string {
    const secret = this.configService.get<string>("FIELD_LOOKUP_SECRET");
    if (!secret) throw new Error("FIELD_LOOKUP_SECRET is not configured");
    return crypto.createHmac("sha256", secret).update(text).digest("hex");
  }

  private encryptionSecret() {
    const secret =
      this.configService.get<string>("ENCRYPTION_SECRET") ??
      this.configService.get<string>("FIELD_ENCRYPTION_KEY_BASE64");
    if (!secret) throw new Error("Encryption secret is not configured");
    return crypto
      .createHash("sha256")
      .update(secret)
      .digest("hex")
      .substring(0, 64);
  }
}
