import { randomUUID } from "node:crypto";
import { Injectable, NestMiddleware } from "@nestjs/common";
import { NextFunction, Request, Response } from "express";
import { RequestContextService } from "./request-context.service";

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  constructor(private readonly requestContext: RequestContextService) {}

  use(request: Request, response: Response, next: NextFunction) {
    const requestId =
      this.firstHeader(request.headers["x-request-id"]) ?? randomUUID();
    const correlationId =
      this.firstHeader(request.headers["x-correlation-id"]) ?? requestId;

    response.setHeader("x-request-id", requestId);
    response.setHeader("x-correlation-id", correlationId);

    this.requestContext.run(
      {
        requestId,
        correlationId,
        ip: request.ip,
        userAgent: request.headers["user-agent"],
      },
      next,
    );
  }

  private firstHeader(
    value: string | string[] | undefined,
  ): string | undefined {
    return Array.isArray(value) ? value[0] : value;
  }
}
