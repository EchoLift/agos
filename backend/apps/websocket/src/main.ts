import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { WebsocketModule } from "./websocket.module";

async function bootstrap() {
  const app = await NestFactory.create(WebsocketModule);
  const config = app.get(ConfigService);
  const port = Number(
    config.get<string>("PORT") ?? config.get<string>("WEBSOCKET_PORT") ?? 4001,
  );
  await app.listen(port);
}

void bootstrap();
