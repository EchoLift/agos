import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable } from '@nestjs/common';

export interface RequestContext {
  requestId: string;
  correlationId: string;
  agencyId?: string;
  userId?: string;
  membershipId?: string;
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class RequestContextService {
  private readonly storage = new AsyncLocalStorage<RequestContext>();

  run(context: RequestContext, callback: () => void) {
    this.storage.run(context, callback);
  }

  get(): RequestContext | undefined {
    return this.storage.getStore();
  }

  append(partial: Partial<RequestContext>) {
    const current = this.get();
    if (current) {
      Object.assign(current, partial);
    }
  }

  requestId(): string | undefined {
    return this.get()?.requestId;
  }

  correlationId(): string | undefined {
    return this.get()?.correlationId;
  }
}

