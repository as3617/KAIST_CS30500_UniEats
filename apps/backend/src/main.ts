import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { AppModule } from "./app.module";
import { ApiExceptionFilter } from "./common/api-exception.filter";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const port = configService.get<number>("PORT", 4000);
  const corsOrigin = configService.get<string>("CORS_ORIGIN", "http://localhost:3000");

  app.setGlobalPrefix("api");
  app.useGlobalFilters(new ApiExceptionFilter());
  app.enableCors({
    origin: corsOrigin,
    credentials: true,
  });

  await app.listen(port);
}

void bootstrap();
