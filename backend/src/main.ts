import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { NestExpressApplication } from '@nestjs/platform-express';
import path from 'node:path';
import fs from 'node:fs';
import { DemoAppModule } from './demo-app.module.js';
import { ResponseTransformInterceptor } from './common/http/response.interceptor.js';
import { AppModule } from './app.module.js';
import { HttpExceptionFilter } from './common/errors/http-exception.filter.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(
    process.env.DEMO_AUTH_ENABLED === 'true' && process.env.NODE_ENV !== 'production' ? DemoAppModule : AppModule
  );

  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }));
  app.use(cookieParser());

  const rootDir = fs.existsSync(path.resolve(process.cwd(), 'backend')) ? path.resolve(process.cwd(), 'backend') : process.cwd();
  const uploadsDir = path.resolve(rootDir, 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  app.useStaticAssets(uploadsDir, { prefix: '/uploads/' });

  app.enableCors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  app.useGlobalInterceptors(new ResponseTransformInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  const port = process.env.PORT || 4000;
  await app.listen(port);
  console.log(`DropConnect API is running on http://localhost:${port}`);
}

bootstrap();
