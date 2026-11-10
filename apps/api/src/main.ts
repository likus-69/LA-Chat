import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  const env = config.get<string>('NODE_ENV', 'development');
  const port = config.get<number>('PORT', 4000);
  const corsOrigins = (config.get<string>('CORS_ORIGINS') || 'http://localhost:3000')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  // Security headers
  app.use(helmet({ contentSecurityPolicy: env === 'production' ? undefined : false }));

  // Cookies (refresh token cookie)
  app.use(cookieParser());

  // CORS
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  // Global validation pipe — DTOs are also validated with Zod inside services,
  // this pipe handles class-validator decorators where present.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  // API versioning prefix
  app.setGlobalPrefix('api/v1', { exclude: ['health'] });

  // OpenAPI / Swagger
  const swaggerConfig = new DocumentBuilder()
    .setTitle('LA Chat API')
    .setDescription('Secure school communication platform — Light Academy Secondary School')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  await app.listen(port);
  logger.log(`LA Chat API listening on :${port} (${env})`);
  logger.log(`Swagger UI at /docs`);
  logger.log(`CORS origins: ${corsOrigins.join(', ')}`);
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Failed to bootstrap LA Chat API', err);
  process.exit(1);
});
