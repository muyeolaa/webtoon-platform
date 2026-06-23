// src/auth/auth.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../user/entity/user.entity';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private jwtService: JwtService,
  ) {}

  // 🚀 소셜 로그인 만능 키! (가입과 로그인을 동시에 처리)
  async validateSocialUser(
    email: string,
    nickname: string,
    provider: string,
    providerId: string,
  ) {
    // 1. 우리 DB에 이 이메일로 가입된 유저가 있는지 확인
    let user = await this.userRepository.findOne({ where: { email } });

    // 2. 만약 처음 온 사람이라면? -> 바로 DB에 저장해서 회원가입 처리!
    if (!user) {
      const newUser = this.userRepository.create({
        email,
        nickname,
        provider,
        providerId,
      });
      user = await this.userRepository.save(newUser);
    }

    // 3. 기존 회원이든 신규 회원이든 여기까지 왔으면 무조건 로그인 성공!
    // 프론트엔드에게 건네줄 마법의 출입증(JWT 토큰)을 발급하자.
    const payload = { email: user.email, sub: user.id };
    const accessToken = this.jwtService.sign(payload);

    return {
      message: `${provider} 로그인 성공!`,
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        role: user.role,
      },
    };
  }
}
