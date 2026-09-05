import { ValidationPipe, VersioningType } from "@nestjs/common";
import type { CorsOptions } from "@nestjs/common/interfaces/external/cors-options.interface";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import * as cookieParser from "cookie-parser";
import helmet from "helmet";
import { Logger } from "nestjs-pino";
import { ApiModule } from "./api.module";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

async function bootstrap() {
  const app = await NestFactory.create(ApiModule, {
    bufferLogs: true,
    rawBody: true,
  });
  app.useLogger(app.get(Logger));

  const config = app.get(ConfigService);
  const corsOrigin =
    config.get<string>("CORS_ORIGIN") ?? "http://localhost:3000";

  const corsOptions: CorsOptions = {
    origin: (origin, callback) => {
      const allowed =
        !origin ||
        origin === corsOrigin ||
        origin === "https://app.agencie.in" ||
        /^https:\/\/[a-z0-9-]+\.agencie\.in$/i.test(origin) ||
        origin.startsWith("http://localhost:");

      if (allowed) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"), false);
      }
    },
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "X-Agency-Id"],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  };

  app.setGlobalPrefix("api");
  app.enableVersioning({ type: VersioningType.URI });
  app.enableCors(corsOptions);

  app.use(
    helmet({
      crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
      crossOriginEmbedderPolicy: false,
    }),
  );

  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle("Agency OS API")
    .setDescription("API documentation for Agency OS")
    .setVersion("1.0")
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("docs", app, document);

  app
    .getHttpAdapter()
    .get("/", (_req, res) =>
      res.json({ status: "ok", api: "/api", docs: "/api/docs" }),
    );

  const port = Number(
    config.get<string>("PORT") ?? config.get<string>("API_PORT") ?? 4000,
  );
  const host = config.get<string>("HOST") ?? "0.0.0.0";

  await app.listen(port, host);
  app.get(Logger).log(`API listening on ${host}:${port}`);
}

void bootstrap();
