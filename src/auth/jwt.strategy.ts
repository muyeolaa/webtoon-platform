// src/auth/jwt.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../user/entity/user.entity';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private configService: ConfigService,
  ) {
    // 🚀 1. super()를 부르기 전에 먼저 .env에서 키를 쏙 빼와!
    const secret = configService.get<string>('JWT_SECRET');

    // 🚀 2. 만약 비밀키가 없다면? 서버 부팅 시점에 아주 큰 에러를 내뿜고 죽여버리기!
    if (!secret) {
      throw new Error('🚨 환경변수(.env)에 JWT_SECRET이 설정되지 않았습니다!');
    }

    // 🚀 3. 안전하게 확인된 키를 요원에게 전달! (TypeScript도 이제 안심함)
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  // 토큰 검증이 통과되면 이 validate 함수가 실행돼!
  async validate(payload: any) {
    // payload.sub 안에는 우리가 아까 토큰을 구울 때 넣었던 user.id가 들어있어.
    const user = await this.userRepository.findOne({
      where: { id: payload.sub },
    });

    if (!user) {
      throw new UnauthorizedException('존재하지 않는 유저입니다.');
    }

    // 여기서 리턴한 값은 앞으로 모든 API에서 `req.user`로 꺼내 쓸 수 있어! (개꿀기능)
    return user;
  }
}
