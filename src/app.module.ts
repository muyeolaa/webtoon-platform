import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { WebtoonModule } from './webtoon/webtoon.module';
import { ScheduleModule } from '@nestjs/schedule';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { BoardModule } from './board/board.module';

// 🚀 1. 방어막(Throttler) 관련 모듈 임포트
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'localhost',
      port: parseInt(process.env.DB_PORT as string, 10),
      username: 'postgres',
      password: process.env.DB_PASSWORD,
      database: process.env.DB_DATABASE,
      // 💡 수정 1: Entity는 엔티티 파일을 넣거나, 아래처럼 자동 검색하게 만듭니다.
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: process.env.NODE_ENV !== 'production',
    }),
    ScheduleModule.forRoot(),

    // 🛡️ 2. 매크로/DoS 공격 방어막 세팅 (같은 IP에서 1분(60000ms) 동안 최대 100번 요청 허용)
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),

    // 💡 수정 2: 웹툰 모듈을 드디어 본사 출근부에 정식 등록합니다!
    WebtoonModule,
    UserModule,
    AuthModule,
    BoardModule,
  ],
  controllers: [],
  providers: [
    // 🛡️ 3. ThrottlerGuard를 애플리케이션 전체(모든 컨트롤러와 API)에 적용!
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
