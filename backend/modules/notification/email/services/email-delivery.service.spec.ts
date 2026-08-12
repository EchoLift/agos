import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { EmailDeliveryService } from "./email-delivery.service";
import { ResendProvider } from "../providers/resend.provider";
import { SendGridProvider } from "../providers/sendgrid.provider";
import { SemanticFailureCategory } from "../interfaces/semantic-failure.enum";

describe("EmailDeliveryService", () => {
  let service: EmailDeliveryService;
  let resendProvider: jest.Mocked<ResendProvider>;
  let sendGridProvider: jest.Mocked<SendGridProvider>;

  beforeEach(async () => {
    const mockResend = {
      name: "RESEND",
      isConfigured: jest.fn(),
      send: jest.fn(),
    };
    const mockSendGrid = {
      name: "SENDGRID",
      isConfigured: jest.fn(),
      send: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailDeliveryService,
        { provide: ResendProvider, useValue: mockResend },
        { provide: SendGridProvider, useValue: mockSendGrid },
      ],
    }).compile();

    service = module.get<EmailDeliveryService>(EmailDeliveryService);
    resendProvider = module.get(ResendProvider);
    sendGridProvider = module.get(SendGridProvider);
  });

  const testMessage = {
    to: "test@example.com",
    subject: "Test Subject",
    html: "<p>Test</p>",
    text: "Test",
  };

  it("should send via Resend primary when configured and successful, without calling SendGrid", async () => {
    resendProvider.isConfigured.mockReturnValue(true);
    resendProvider.send.mockResolvedValue({
      success: true,
      provider: "RESEND",
      providerMessageId: "msg_123",
    });

    const result = await service.sendEmail(testMessage);

    expect(result.success).toBe(true);
    expect(result.provider).toBe("RESEND");
    expect(result.providerMessageId).toBe("msg_123");
    expect(sendGridProvider.send).not.toHaveBeenCalled();
  });

  it("should fallback to SendGrid when Resend fails with a transient error and SendGrid is configured", async () => {
    resendProvider.isConfigured.mockReturnValue(true);
    resendProvider.send.mockResolvedValue({
      success: false,
      provider: "RESEND",
      failureCategory: SemanticFailureCategory.PROVIDER_UNAVAILABLE,
      error: "Resend server error 503",
    });

    sendGridProvider.isConfigured.mockReturnValue(true);
    sendGridProvider.send.mockResolvedValue({
      success: true,
      provider: "SENDGRID",
      providerMessageId: "sg_456",
    });

    const result = await service.sendEmail(testMessage);

    expect(resendProvider.send).toHaveBeenCalledWith(testMessage);
    expect(sendGridProvider.send).toHaveBeenCalledWith(testMessage);
    expect(result.success).toBe(true);
    expect(result.provider).toBe("SENDGRID");
  });

  it("should NOT fallback to SendGrid when Resend fails with a permanent error (e.g. RECIPIENT_INVALID)", async () => {
    resendProvider.isConfigured.mockReturnValue(true);
    resendProvider.send.mockResolvedValue({
      success: false,
      provider: "RESEND",
      failureCategory: SemanticFailureCategory.RECIPIENT_INVALID,
      error: "Invalid recipient address",
    });

    sendGridProvider.isConfigured.mockReturnValue(true);

    const result = await service.sendEmail(testMessage);

    expect(resendProvider.send).toHaveBeenCalledWith(testMessage);
    expect(sendGridProvider.send).not.toHaveBeenCalled();
    expect(result.success).toBe(false);
    expect(result.failureCategory).toBe(SemanticFailureCategory.RECIPIENT_INVALID);
  });

  it("should return failure gracefully when no providers are configured", async () => {
    resendProvider.isConfigured.mockReturnValue(false);
    sendGridProvider.isConfigured.mockReturnValue(false);

    const result = await service.sendEmail(testMessage);

    expect(result.success).toBe(false);
    expect(result.provider).toBe("NONE");
    expect(result.failureCategory).toBe(SemanticFailureCategory.PROVIDER_UNAVAILABLE);
  });
});
