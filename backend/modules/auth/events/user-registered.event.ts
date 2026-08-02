export class UserRegisteredEventPayload {
  public readonly eventType = "UserRegistered";

  constructor(
    public readonly authUserId: string,
    public readonly emailHash: string,
    public readonly occurredAt: string,
    public readonly requestId?: string,
    public readonly correlationId?: string,
  ) {}
}
