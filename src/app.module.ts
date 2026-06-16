import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { WebtoonModule } from './webtoon/webtoon.module';
import { ScheduleModule } from '@nestjs/schedule';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
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
      synchronize: true,
    }),
    ScheduleModule.forRoot(),

    // 💡 수정 2: 웹툰 모듈을 드디어 본사 출근부에 정식 등록합니다!
    WebtoonModule,
    UserModule,
    AuthModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
