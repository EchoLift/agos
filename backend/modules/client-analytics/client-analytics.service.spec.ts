import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  PayloadTooLargeException,
} from "@nestjs/common";
import { AnalyticsFileCategory } from "@prisma/client";
import { DomainEvents } from "@packages/events/domain-event";
import { IdentityContext } from "@packages/security/interfaces/identity-context.interface";
import {
  ClientAnalyticsService,
  MAX_AGGREGATE_PAYLOAD_SIZE,
  MAX_FILES_PER_REQUEST,
  MAX_SINGLE_FILE_SIZE,
} from "./client-analytics.service";
import { R2StorageService } from "./r2-storage.service";

describe("ClientAnalyticsService & R2StorageService", () => {
  let service: ClientAnalyticsService;
  let r2Storage: R2StorageService;
  let prisma: any;
  let eventBus: any;
  let config: any;

  const mockActor: IdentityContext = {
    authUserId: "auth-123",
    userId: "user-123",
    sessionId: "session-123",
    agencyId: "agency-456",
    membershipId: "member-789",
    role: "OWNER",
    roles: ["OWNER"],
    permissions: ["CLIENT_UPDATE"],
  };


  beforeEach(() => {
    config = {
      get: jest.fn((key: string) => {
        if (key === "R2_BUCKET_NAME") return "agencie-client-analytics";
        if (key === "R2_ENDPOINT") return "https://mock.r2.cloudflarestorage.com";
        if (key === "R2_ACCESS_KEY_ID") return "mock-access-key";
        if (key === "R2_SECRET_ACCESS_KEY") return "mock-secret-key";
        if (key === "R2_REGION") return "auto";
        return null;
      }),
    };

    prisma = {
      client: {
        findFirst: jest.fn(),
      },
      clientAnalyticsAsset: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    };

    eventBus = {
      publish: jest.fn().mockResolvedValue({}),
    };

    r2Storage = new R2StorageService(config);
    jest.spyOn(r2Storage, "uploadObject").mockResolvedValue(undefined);
    jest.spyOn(r2Storage, "deleteObject").mockResolvedValue(undefined);
    jest
      .spyOn(r2Storage, "getSignedDownloadUrl")
      .mockResolvedValue("https://mock-signed-url.example/test.png");

    service = new ClientAnalyticsService(prisma, r2Storage, eventBus);
  });

  describe("File Classification", () => {
    it("classifies files accurately by MIME type and extension fallback", () => {
      expect(
        service.classifyAnalyticsFile("image/png", "banner.png"),
      ).toBe(AnalyticsFileCategory.IMAGE);
      expect(
        service.classifyAnalyticsFile("image/jpeg", "photo.jpg"),
      ).toBe(AnalyticsFileCategory.IMAGE);
      expect(
        service.classifyAnalyticsFile("video/mp4", "promo.mp4"),
      ).toBe(AnalyticsFileCategory.VIDEO);
      expect(
        service.classifyAnalyticsFile("application/pdf", "august_report.pdf"),
      ).toBe(AnalyticsFileCategory.PDF);
      expect(
        service.classifyAnalyticsFile("text/csv", "metrics.csv"),
      ).toBe(AnalyticsFileCategory.SPREADSHEET);
      expect(
        service.classifyAnalyticsFile(
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "data.xlsx",
        ),
      ).toBe(AnalyticsFileCategory.SPREADSHEET);
      expect(
        service.classifyAnalyticsFile("application/msword", "notes.doc"),
      ).toBe(AnalyticsFileCategory.DOCUMENT);
      expect(
        service.classifyAnalyticsFile("text/plain", "readme.txt"),
      ).toBe(AnalyticsFileCategory.DOCUMENT);
      expect(
        service.classifyAnalyticsFile("application/octet-stream", "raw.unknown"),
      ).toBe(AnalyticsFileCategory.OTHER);
    });
  });

  describe("R2 Key Generation & Sanitization", () => {
    it("generates authoritative R2 key structure with zero-padded month and folder", () => {
      const key = r2Storage.buildClientAnalyticsKey({
        agencyId: "agency-1",
        clientId: "client-2",
        year: 2026,
        month: 8,
        category: AnalyticsFileCategory.SPREADSHEET,
        fileName: "August Performance Metrics (2026).xlsx",
      });

      expect(key).toMatch(
        /^agencies\/agency-1\/clients\/client-2\/2026\/08\/spreadsheets\/[a-f0-9-]+-August-Performance-Metrics-2026\.xlsx$/,
      );
    });

    it("sanitizes filenames stripping path traversal and control characters", () => {
      expect(r2Storage.sanitizeFileName("../../../etc/passwd.png")).toBe(
        "passwd.png",
      );
      expect(r2Storage.sanitizeFileName("my spaced report #1!.pdf")).toBe(
        "my-spaced-report-1.pdf",
      );
      expect(r2Storage.sanitizeFileName("")).toBe("unnamed-file");
    });
  });

  describe("Batch Upload Semantics & Limits", () => {
    it("processes mixed file batches, stores metadata, and publishes domain event", async () => {
      prisma.client.findFirst.mockResolvedValue({
        id: "client-1",
        agencyId: "agency-456",
        name: "Acme Corp",
      });

      prisma.clientAnalyticsAsset.create.mockImplementation(({ data }: any) =>
        Promise.resolve({
          id: `asset-${data.originalFileName}`,
          ...data,
          createdAt: new Date(),
        }),
      );

      const files: any[] = [
        {
          originalname: "chart.png",
          mimetype: "image/png",
          size: 1024,
          buffer: Buffer.from("fake-image"),
        },
        {
          originalname: "report.pdf",
          mimetype: "application/pdf",
          size: 2048,
          buffer: Buffer.from("fake-pdf"),
        },
      ];

      const result = await service.uploadFiles(
        "client-1",
        files,
        { year: 2026, month: 8 },
        mockActor,
      );

      expect(result.uploaded).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.period).toEqual({
        year: 2026,
        month: 8,
        label: "August 2026",
      });
      expect(result.groups).toHaveLength(2);
      expect(r2Storage.uploadObject).toHaveBeenCalledTimes(2);
      expect(prisma.clientAnalyticsAsset.create).toHaveBeenCalledTimes(2);
      expect(eventBus.publish).toHaveBeenCalledWith(
        DomainEvents.ClientAnalyticsAssetUploaded,
        expect.objectContaining({
          agencyId: "agency-456",
          actorId: "user-123",
          payload: expect.objectContaining({
            clientId: "client-1",
            year: 2026,
            month: 8,
            uploadedCount: 2,
          }),
        }),
      );
    });

    it("defaults to current period when year and month are omitted", async () => {
      prisma.client.findFirst.mockResolvedValue({
        id: "client-1",
        agencyId: "agency-456",
      });
      prisma.clientAnalyticsAsset.create.mockResolvedValue({
        id: "asset-1",
        category: AnalyticsFileCategory.IMAGE,
      });

      const now = new Date();
      const currentYear = now.getUTCFullYear();
      const currentMonth = now.getUTCMonth() + 1;

      const files: any[] = [
        {
          originalname: "test.png",
          mimetype: "image/png",
          size: 500,
          buffer: Buffer.from("data"),
        },
      ];

      const result = await service.uploadFiles(
        "client-1",
        files,
        {},
        mockActor,
      );

      expect(result.period.year).toBe(currentYear);
      expect(result.period.month).toBe(currentMonth);
    });

    it("rejects empty file uploads", async () => {
      await expect(
        service.uploadFiles("client-1", [], {}, mockActor),
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects batch exceeding max files limit", async () => {
      const files: any[] = Array(MAX_FILES_PER_REQUEST + 1).fill({
        originalname: "file.png",
        mimetype: "image/png",
        size: 100,
        buffer: Buffer.from("data"),
      });

      await expect(
        service.uploadFiles("client-1", files, {}, mockActor),
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects batch exceeding aggregate payload size limit", async () => {
      const files: any[] = [
        {
          originalname: "huge.pdf",
          mimetype: "application/pdf",
          size: MAX_AGGREGATE_PAYLOAD_SIZE + 100,
          buffer: Buffer.from("data"),
        },
      ];

      await expect(
        service.uploadFiles("client-1", files, {}, mockActor),
      ).rejects.toThrow(PayloadTooLargeException);
    });

    it("reports file-level failure for single file exceeding max size without failing entire batch", async () => {
      prisma.client.findFirst.mockResolvedValue({
        id: "client-1",
        agencyId: "agency-456",
      });
      prisma.clientAnalyticsAsset.create.mockResolvedValue({
        id: "asset-1",
        category: AnalyticsFileCategory.IMAGE,
      });

      const files: any[] = [
        {
          originalname: "valid.png",
          mimetype: "image/png",
          size: 1000,
          buffer: Buffer.from("data"),
        },
        {
          originalname: "oversized.pdf",
          mimetype: "application/pdf",
          size: MAX_SINGLE_FILE_SIZE + 100,
          buffer: Buffer.from("huge"),
        },
      ];

      const result = await service.uploadFiles(
        "client-1",
        files,
        {},
        mockActor,
      );

      expect(result.uploaded).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.failures[0]).toEqual({
        fileName: "oversized.pdf",
        code: "FILE_TOO_LARGE",
        message: expect.stringContaining("25MB"),
      });
    });

    it("performs compensating R2 cleanup when DB metadata insert fails after R2 upload", async () => {
      prisma.client.findFirst.mockResolvedValue({
        id: "client-1",
        agencyId: "agency-456",
      });
      prisma.clientAnalyticsAsset.create.mockRejectedValue(
        new Error("Database connection lost"),
      );

      const files: any[] = [
        {
          originalname: "report.pdf",
          mimetype: "application/pdf",
          size: 1000,
          buffer: Buffer.from("data"),
        },
      ];

      const result = await service.uploadFiles(
        "client-1",
        files,
        {},
        mockActor,
      );

      expect(result.uploaded).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.failures[0]).toEqual({
        fileName: "report.pdf",
        code: "UPLOAD_FAILED",
        message: "File could not be stored.",
      });
      expect(r2Storage.uploadObject).toHaveBeenCalled();
      expect(r2Storage.deleteObject).toHaveBeenCalled();
    });
  });

  describe("Tenant & Client Authorization Scoping", () => {
    it("rejects upload when client does not belong to actor agency", async () => {
      prisma.client.findFirst.mockResolvedValue(null);

      const files: any[] = [
        {
          originalname: "test.png",
          mimetype: "image/png",
          size: 100,
          buffer: Buffer.from("data"),
        },
      ];

      await expect(
        service.uploadFiles("client-foreign", files, {}, mockActor),
      ).rejects.toThrow(NotFoundException);
    });

    it("rejects client-scoped user accessing another client data", async () => {
      const clientActor: IdentityContext = {
        authUserId: "auth-client-1",
        userId: "user-client-1",
        sessionId: "session-client-1",
        agencyId: "agency-456",
        clientId: "client-own",
        role: "CLIENT",
        roles: ["CLIENT"],
        permissions: [],
      };


      prisma.client.findFirst.mockResolvedValue({
        id: "client-other",
        agencyId: "agency-456",
      });

      const files: any[] = [
        {
          originalname: "test.png",
          mimetype: "image/png",
          size: 100,
          buffer: Buffer.from("data"),
        },
      ];

      await expect(
        service.uploadFiles("client-other", files, {}, clientActor),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe("Grouped Retrieval", () => {
    it("returns active files grouped by category with BigInt converted to number", async () => {
      prisma.client.findFirst.mockResolvedValue({ id: "client-1" });
      prisma.clientAnalyticsAsset.findMany.mockResolvedValue([
        {
          id: "asset-1",
          originalFileName: "chart.png",
          mimeType: "image/png",
          extension: "png",
          sizeBytes: BigInt(54321),
          category: AnalyticsFileCategory.IMAGE,
          year: 2026,
          month: 8,
          createdAt: new Date("2026-08-21T10:00:00Z"),
          uploadedByUser: { id: "user-1", name: "Alex" },
        },
        {
          id: "asset-2",
          originalFileName: "report.pdf",
          mimeType: "application/pdf",
          extension: "pdf",
          sizeBytes: BigInt(123456),
          category: AnalyticsFileCategory.PDF,
          year: 2026,
          month: 8,
          createdAt: new Date("2026-08-21T11:00:00Z"),
          uploadedByUser: { id: "user-1", name: "Alex" },
        },
      ]);

      const result = await service.getFilesGrouped(
        "client-1",
        { year: 2026, month: 8 },
        mockActor,
      );

      expect(result.totalFiles).toBe(2);
      expect(result.period.label).toBe("August 2026");
      const imageGroup = result.groups.find((g) => g.category === "IMAGE");
      expect(imageGroup?.count).toBe(1);
      expect(imageGroup?.files[0].sizeBytes).toBe(54321);
      expect(typeof imageGroup?.files[0].sizeBytes).toBe("number");
    });
  });

  describe("Presigned Download & Preview URL", () => {
    it("generates signed URL with disposition header after tenancy verification", async () => {
      prisma.clientAnalyticsAsset.findFirst.mockResolvedValue({
        id: "asset-1",
        clientId: "client-1",
        agencyId: "agency-456",
        objectKey: "agencies/agency-456/clients/client-1/2026/08/images/uuid-banner.png",
        originalFileName: "banner.png",
        deletedAt: null,
      });

      const result = await service.getDownloadSignedUrl(
        "client-1",
        "asset-1",
        mockActor,
        false,
      );

      expect(result.url).toBe("https://mock-signed-url.example/test.png");
      expect(result.expiresIn).toBe(300);
      expect(result.fileName).toBe("banner.png");
      expect(r2Storage.getSignedDownloadUrl).toHaveBeenCalledWith(
        "agencies/agency-456/clients/client-1/2026/08/images/uuid-banner.png",
        "banner.png",
        300,
        false,
      );
    });

    it("refuses signed download if asset is soft-deleted", async () => {
      prisma.clientAnalyticsAsset.findFirst.mockResolvedValue(null);

      await expect(
        service.getDownloadSignedUrl("client-1", "asset-deleted", mockActor),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("Soft Delete Behavior", () => {
    it("marks asset deletedAt and publishes domain event", async () => {
      prisma.clientAnalyticsAsset.findFirst.mockResolvedValue({
        id: "asset-1",
        clientId: "client-1",
        agencyId: "agency-456",
        objectKey: "agencies/agency-456/...",
      });
      prisma.clientAnalyticsAsset.update.mockResolvedValue({
        id: "asset-1",
        deletedAt: new Date(),
      });

      const result = await service.deleteFile("client-1", "asset-1", mockActor);

      expect(result.success).toBe(true);
      expect(prisma.clientAnalyticsAsset.update).toHaveBeenCalledWith({
        where: { id: "asset-1" },
        data: { deletedAt: expect.any(Date) },
      });
      expect(eventBus.publish).toHaveBeenCalledWith(
        DomainEvents.ClientAnalyticsAssetDeleted,
        expect.objectContaining({
          agencyId: "agency-456",
          actorId: "user-123",
          payload: expect.objectContaining({
            clientId: "client-1",
            assetId: "asset-1",
          }),
        }),
      );
    });
  });
});
