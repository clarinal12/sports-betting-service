import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './shared/filters/all-exceptions.filter';
import type { EnvConfig } from './shared/config/env.validation';
import { RedisService } from './shared/cache/redis.service';
import { RedisIoAdapter } from './shared/websocket/redis-io.adapter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  const redis = app.get(RedisService);
  await redis.ping();
  app.useWebSocketAdapter(new RedisIoAdapter(app, redis.getClient()));

  app.setGlobalPrefix('api/v1', {
    exclude: ['health', 'ready'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  const configService = app.get(ConfigService<EnvConfig, true>);
  const port = configService.get('PORT', { infer: true });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Sports Betting Service')
    .setDescription(
      'Live events, schedules, markets, and odds (MVP: display-only).',
    )
    .setVersion('0.0.1')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(port);
}

void bootstrap();
