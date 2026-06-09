// NestJS 백엔드의 src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 🚀 프론트엔드(3001번)가 데이터를 가져갈 수 있도록 문을 활짝 열어줍니다!
  app.enableCors({
    origin: true, // 혹은 'http://localhost:3001'
    credentials: true,
  });

  await app.listen(3000);
}
bootstrap();
