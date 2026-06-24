// src/auth/strategies/google.strategy.ts
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor() {
    super({
      clientID: process.env.GOOGLE_CLIENT_ID || '임시_클라이언트_ID',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '임시_시크릿_KEY',
      callbackURL: 'http://localhost:3000/auth/google/callback', // 구글 도착지 주소
      scope: ['email', 'profile'], // 구글한테서 받아올 정보 (이메일, 프로필)
    });
  }

  async validate(accessToken: string, refreshToken: string, profile: any, done: VerifyCallback) {
    const { id, emails, displayName } = profile;
    
    const user = {
      email: emails[0].value,
      nickname: displayName, // 구글 이름 (초기 가입 시엔 '유저_XXXX'로 바뀜)
      provider: 'google',
      providerId: id,
    };

    done(null, user);
  }
}