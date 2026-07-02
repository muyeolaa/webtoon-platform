import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: [
      'http://localhost:3000',
      'http://localhost:3001', // 기존에 쓰시던 3001번 포트도 혹시 몰라 남겨둡니다!
      process.env.FRONTEND_URL, // Render 환경변수에 등록할 Vercel 주소
    ],
    credentials: true, // ⭐️ 쿠키(토큰)를 주고받기 위한 필수 설정
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    exposedHeaders: ['Authorization'], // 프론트에서 헤더 토큰을 읽을 수 있게 허용
  });

  // 유효성 검사
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // DTO에 정의되지 않은 이상한 데이터가 들어오면 알아서 쳐내고 받음
      forbidNonWhitelisted: true, // DTO에 없는 데이터가 들어오면 바로 400 에러를 뱉어버림!
      transform: true, // 프론트에서 보낸 문자열 데이터를 우리가 원하는 타입(숫자 등)으로 자동 변환해 줌
    }),
  );

  // 🚀 [수정] Render는 서버를 띄울 때 포트 번호를 마음대로 할당합니다.
  // 무조건 3000번으로 고정하면 에러가 나므로, process.env.PORT를 먼저 찾게 만듭니다.

  app.useGlobalFilters(new AllExceptionsFilter());
  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`🚀 백엔드 서버가 ${port}번 포트에서 실행 중입니다!`);
}

bootstrap();
