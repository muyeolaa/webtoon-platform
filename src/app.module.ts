import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WebtoonModule } from './webtoon/entities/webtoon.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',        // 👈 mysql에서 postgres로 변경!
      host: 'localhost',
      port: 5432,              // 👈 PostgreSQL의 기본 포트는 5432입니다.
      username: 'postgres',    // 👈 기본 관리자 아이디 (보통 'postgres'를 씁니다)
      password: 'password',    // 본인이 설치할 때 설정한 비밀번호
      database: 'webtoon_db',  // 사용할 DB 이름
      entities: [WebtoonModule],
      synchronize: true,       
    }),
    TypeOrmModule.forFeature([WebtoonModule]),
  ],  
  controllers: [],
  providers: [],
})
export class AppModule {}
