import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/errors/http-exception.filter';
import { ResponseTransformInterceptor } from './common/http/response.interceptor';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('DropConnect');
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: true,
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
  });

  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new ResponseTransformInterceptor());

  const port = process.env.PORT || 4000;
  await app.listen(port);
  logger.log(`DropConnect API server running at http://localhost:${port}`);
  logger.log(`Health endpoint available at http://localhost:${port}/health`);
}

bootstrap();
