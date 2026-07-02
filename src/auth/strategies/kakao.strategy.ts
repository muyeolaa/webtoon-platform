// src/auth/strategies/kakao.strategy.ts
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-kakao';

@Injectable()
export class KakaoStrategy extends PassportStrategy(Strategy, 'kakao') {
  constructor() {
    super({
      clientID: process.env.KAKAO_CLIENT_ID as string,
      // 🚀 [추가] 카카오 서버와 비밀 대화를 나눌 철통 보안 시크릿 키 장착!
      clientSecret: process.env.KAKAO_CLIENT_SECRET as string,
      // 🚀 [수정] 배포 환경(Render)에서는 환경변수를, 로컬에서는 기존 주소를 쓰도록 유연하게 설정!
      callbackURL:
        process.env.KAKAO_CALLBACK_URL ||
        'http://localhost:3000/auth/kakao/callback',
    });
  }

  // 카카오가 로그인을 성공시키고 유저 정보를 이 함수로 던져줄 거야!
  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: (error: any, user?: any, info?: any) => void,
  ) {
    try {
      const { _json } = profile;

      // 🚀 카카오가 데이터를 안 줬을 때를 대비한 안전한(Safe) 데이터 추출! (옵셔널 체이닝 '?.' 사용)
      const user = {
        // 이메일이 없으면 'kakao_고유번호@moatoon.com' 같은 임시 이메일을 강제로 만들어줌!
        email: _json?.kakao_account?.email || `kakao_${profile.id}@moatoon.com`,
        // 닉네임이 없으면 '카카오유저'라는 기본값 부여
        nickname: _json?.properties?.nickname || '카카오유저',
        provider: 'kakao',
        providerId: profile.id.toString(),
      };

      done(null, user);
    } catch (error) {
      done(error);
    }
  }
}
