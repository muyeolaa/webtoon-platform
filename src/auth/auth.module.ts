// src/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UserModule } from '../user/user.module'; // 🚀 유저 모듈 수입!
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './jwt.strategy'; // 🚀 추가
import { PassportModule } from '@nestjs/passport'; // 🚀 추가
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    UserModule,
    PassportModule,
    // 🚀 register -> registerAsync로 변경!
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '1h' },
      }),
    }),
  ],
  controllers: [AuthController], // 프론트엔드와 통신할 창구 등록
  providers: [AuthService, JwtStrategy], // 비즈니스 로직 등록
})
export class AuthModule {}
