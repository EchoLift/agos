import { Test, TestingModule } from "@nestjs/testing";
import { PasswordService } from "./password.service";

describe("PasswordService", () => {
  let service: PasswordService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PasswordService],
    }).compile();

    service = module.get<PasswordService>(PasswordService);
  });

  it("should hash a password and verify it successfully", async () => {
    const password = "StrongPassword123!";
    const hash = await service.hash(password);

    expect(hash).not.toEqual(password);
    expect(hash.startsWith("$argon2id$")).toBeTruthy();

    const isValid = await service.verify(hash, password);
    expect(isValid).toBe(true);
  });

  it("should fail to verify with wrong password", async () => {
    const password = "StrongPassword123!";
    const hash = await service.hash(password);

    const isValid = await service.verify(hash, "WrongPassword123!");
    expect(isValid).toBe(false);
  });

  it("should fail gracefully if hash is invalid", async () => {
    const isValid = await service.verify("invalid-hash", "password");
    expect(isValid).toBe(false);
  });
});
