// NestJS 백엔드의 src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 🚀 프론트엔드(3001번)가 데이터를 가져갈 수 있도록 문을 활짝 열어줍니다!
  app.enableCors({
    origin: true, // 혹은 'http://localhost:3001'
    credentials: true,
  });

  // 유효성 검사
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // DTO에 정의되지 않은 이상한 데이터가 들어오면 알아서 쳐내고 받음
      forbidNonWhitelisted: true, // DTO에 없는 데이터가 들어오면 바로 400 에러를 뱉어버림! (보안 철벽)
      transform: true, // 프론트에서 보낸 문자열 데이터를 우리가 원하는 타입(숫자 등)으로 자동 변환해 줌
    }),
  );

  await app.listen(3000);
}
bootstrap();
