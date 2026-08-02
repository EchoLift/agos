import { AsyncLocalStorage } from "node:async_hooks";
import { Injectable } from "@nestjs/common";
import { IdentityContext } from "../interfaces/identity-context.interface";

@Injectable()
export class SecurityContextService {
  private readonly storage = new AsyncLocalStorage<IdentityContext>();

  run(context: IdentityContext, callback: () => void) {
    this.storage.run(context, callback);
  }

  get(): IdentityContext | undefined {
    return this.storage.getStore();
  }

  append(partial: Partial<IdentityContext>) {
    const current = this.get();
    if (current) {
      Object.assign(current, partial);
    }
  }

  get authUserId(): string | undefined {
    return this.get()?.authUserId;
  }

  get userId(): string | undefined {
    return this.get()?.userId;
  }

  get agencyId(): string | undefined {
    return this.get()?.agencyId;
  }

  get membershipId(): string | undefined {
    return this.get()?.membershipId;
  }
}
