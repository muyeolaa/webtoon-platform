// src/user/user.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt'; // 🚀 새 토큰 발급을 위해 JWT 모듈 추가!
import { User } from './entity/user.entity';
import { UserController } from './user.controller';
import { UserService } from './user.service'; // 🚀 방금 만든 서비스 가져오기

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    // 💡 [중요] auth.module.ts에 설정된 secret Key 및 만료 시간과 완벽히 일치시켜 줍니다.
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'jwt-secret-key',
      signOptions: { expiresIn: '1d' },
    }),
  ],
  controllers: [UserController],
  providers: [UserService], // 🚀 메인 두꺼비집에 서비스 등록!
  exports: [TypeOrmModule],
})
export class UserModule {}
