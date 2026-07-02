// src/auth/strategies/naver.strategy.ts
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-naver-v2';

@Injectable()
export class NaverStrategy extends PassportStrategy(Strategy, 'naver') {
  constructor() {
    super({
      // 💡 개발용 네이버 개발자 센터에서 발급받을 값들 (이따가 환경변수에 넣을 거야)
      clientID: process.env.NAVER_CLIENT_ID || '임시_클라이언트_ID',
      clientSecret: process.env.NAVER_CLIENT_SECRET || '임시_시크릿_KEY',
      callbackURL:
        process.env.NAVER_CALLBACK_URL ||
        'http://localhost:3000/auth/kakao/callback',
    });
  }

  // 네이버 로그인이 성공하면 네이버가 유저 정보를 이 함수로 휙 던져줘!
  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: Function,
  ) {
    const { email, nickname, id } = profile;

    const user = {
      email,
      nickname, // 네이버 프로필 이름 (처음 가입 시엔 아까 만든 '유저_4자리'로 바뀔 예정)
      provider: 'naver',
      providerId: id, // 네이버가 준 고유 유저 ID 번호
    };

    done(null, user);
  }
}
