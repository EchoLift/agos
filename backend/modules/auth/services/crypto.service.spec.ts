import { Test, TestingModule } from '@nestjs/testing';
import { CryptoService } from './crypto.service';
import { ConfigService } from '@nestjs/config';

describe('CryptoService', () => {
  let service: CryptoService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CryptoService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'ENCRYPTION_SECRET') return 'test-encryption-secret-1234567890';
              if (key === 'FIELD_LOOKUP_SECRET') return 'test-lookup-secret';
              return null;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<CryptoService>(CryptoService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should encrypt and decrypt correctly', () => {
    const plainText = 'test@example.com';
    const encrypted = service.encrypt(plainText);
    
    expect(encrypted).not.toEqual(plainText);
    expect(encrypted.split(':').length).toBe(3); // iv:authTag:encrypted

    const decrypted = service.decrypt(encrypted);
    expect(decrypted).toEqual(plainText);
  });

  it('should produce consistent lookup hashes', () => {
    const text = 'test@example.com';
    const hash1 = service.hashLookup(text);
    const hash2 = service.hashLookup(text);

    expect(hash1).toEqual(hash2);
    expect(hash1.length).toBe(64); // sha256 hex length
  });
});
