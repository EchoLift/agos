import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { HttpAdapterHost } from "@nestjs/core";
import { Logger } from "nestjs-pino";
import { Prisma } from "@prisma/client";
import { RequestContextService } from "@packages/request-context/request-context.service";

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(
    private readonly httpAdapterHost: HttpAdapterHost,
    private readonly logger: Logger,
    private readonly requestContext: RequestContextService,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();
    const request = ctx.getRequest();

    let httpStatus = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | object = "Internal server error";
    let errorType = "InternalServerError";

    if (exception instanceof HttpException) {
      httpStatus = exception.getStatus();
      const response = exception.getResponse();
      message =
        typeof response === "object" && "message" in response
          ? (response as any).message
          : response;
      errorType = exception.constructor.name;
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      httpStatus = HttpStatus.BAD_REQUEST;
      message = this.getPrismaErrorMessage(exception);
      errorType = "DatabaseError";
    } else if (exception instanceof Error) {
      message = exception.message;
      errorType = exception.name;
    }

    const context = this.requestContext.get();
    const requestId =
      context?.requestId || request.headers["x-request-id"] || "unknown";

    const responseBody = {
      statusCode: httpStatus,
      error: errorType,
      message: httpStatus >= 500 ? "Internal server error" : message,
      requestId,
      path: httpAdapter.getRequestUrl(request),
      timestamp: new Date().toISOString(),
    };

    if (httpStatus >= 500) {
      this.logger.error(
        { err: exception, requestId },
        `Unhandled exception: ${errorType}`,
      );
    } else {
      this.logger.warn(
        { err: exception, requestId },
        `Client error: ${errorType}`,
      );
    }

    httpAdapter.reply(ctx.getResponse(), responseBody, httpStatus);
  }

  private getPrismaErrorMessage(
    error: Prisma.PrismaClientKnownRequestError,
  ): string {
    switch (error.code) {
      case "P2002":
        return "Unique constraint failed";
      case "P2025":
        return "Record not found";
      default:
        return "Database error occurred";
    }
  }
}
