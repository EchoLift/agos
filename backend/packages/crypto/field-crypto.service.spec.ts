import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { FieldCryptoService } from "./field-crypto.service";
import { CryptoService } from "@modules/auth/services/crypto.service";

describe("FieldCryptoService Compatibility", () => {
  let fieldCrypto: FieldCryptoService;
  let authCrypto: CryptoService;

  beforeEach(async () => {
    const configMap: Record<string, string> = {
      ENCRYPTION_SECRET: "test-secret-key-that-is-32-bytes-long!!",
      FIELD_ENCRYPTION_KEY_BASE64: Buffer.from("test-secret-key-that-is-32-bytes-long!!").toString("base64"),
      FIELD_LOOKUP_SECRET: "test-lookup-secret",
    };

    const mockConfig = {
      get: jest.fn((key: string) => configMap[key]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FieldCryptoService,
        CryptoService,
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    fieldCrypto = module.get<FieldCryptoService>(FieldCryptoService);
    authCrypto = module.get<CryptoService>(CryptoService);
  });

  it("should decrypt ciphertext encrypted by CryptoService (colon-separated format)", () => {
    const plainText = "invitee@example.com";
    const encryptedByAuth = authCrypto.encrypt(plainText);

    expect(encryptedByAuth).toContain(":");

    const decryptedByField = fieldCrypto.decrypt(encryptedByAuth);
    expect(decryptedByField).toBe(plainText);
  });

  it("should encrypt and decrypt using FieldCryptoService itself", () => {
    const plainText = "test@example.com";
    const encrypted = fieldCrypto.encrypt(plainText);
    const decrypted = fieldCrypto.decrypt(encrypted);

    expect(decrypted).toBe(plainText);
  });
});
