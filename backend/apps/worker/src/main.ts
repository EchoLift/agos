import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { WorkerModule } from "./worker.module";

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(WorkerModule);
  const logger = new Logger("Worker");
  logger.log("Agency OS worker started");

  process.on("SIGTERM", async () => {
    logger.log("Worker shutting down");
    await app.close();
    process.exit(0);
  });
}

void bootstrap();
