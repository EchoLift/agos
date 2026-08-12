import { ValidationPipe, VersioningType } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import * as cookieParser from "cookie-parser";
import helmet from "helmet";
import { Logger } from "nestjs-pino";
import { ApiModule } from "./api.module";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

async function bootstrap() {
  const app = await NestFactory.create(ApiModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  const config = app.get(ConfigService);
  const corsOrigin =
    config.get<string>("CORS_ORIGIN") ?? "http://localhost:3000";

  app.setGlobalPrefix("api");
  app.enableVersioning({ type: VersioningType.URI });
  app.enableCors({
    origin: (origin, callback) => {
      if (
        !origin ||
        origin === corsOrigin ||
        /\.client-agos\.calcie\.fun$/.test(origin) ||
        origin === "https://client-agos.calcie.fun" ||
        origin.startsWith("http://localhost:")
      ) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "X-Agency-Id"],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });
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

  // Expose a lightweight root route for Render / health checks.
  app.getHttpAdapter().get("/", (_req, res) =>
    res.json({ status: "ok", api: "/api", docs: "/api/docs" }),
  );

  const port = Number(
    config.get<string>("PORT") ?? config.get<string>("API_PORT") ?? 4000,
  );
  await app.listen(port);
}

void bootstrap();
