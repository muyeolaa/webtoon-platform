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
      // 🚀 1. 하드코딩 제거! 이제 env 파일에서 클라우드 주소와 아이디를 읽어옵니다.
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT as string, 10),
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_DATABASE,
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: process.env.NODE_ENV !== 'production',

      // 🚀 2. [매우 중요] 클라우드 DB(Neon) 접속을 위한 SSL 암호화 설정 추가!
      ssl: {
        rejectUnauthorized: false,
      },
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
