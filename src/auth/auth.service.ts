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
    nickname: string, // 카카오가 준 이름 (이제 초기 가입 시엔 안 쓰고, 필요하면 따로 저장)
    provider: string,
    providerId: string,
  ) {
    // 1. 우리 DB에 이 이메일로 가입된 유저가 있는지 확인
    let user = await this.userRepository.findOne({ where: { email } });

    // 2. 만약 처음 온 사람이라면? -> 바로 DB에 저장해서 회원가입 처리!
    if (!user) {
      // 🚀 6자리 랜덤 숫자 생성 (예: 134829)
      const randomNumber = Math.floor(1000 + Math.random() * 9000);
      // 🚀 초기 닉네임을 '유저_4자리숫자'로 강제 지정!
      const defaultNickname = `유저_${randomNumber}`;

      const newUser = this.userRepository.create({
        email,
        nickname: defaultNickname, // 👈 카카오 이름 대신 임시 닉네임 쏙 넣기
        provider,
        providerId,
      });
      user = await this.userRepository.save(newUser);
    }

    // 3. 기존 회원이든 신규 회원이든 여기까지 왔으면 무조건 로그인 성공!
    // (여기서 payload에 담기는 nickname은 이제 방금 생성된 '유저_XXXXXX' 또는 기존에 쓰던 닉네임이 됨)
    const payload = {
      email: user.email,
      sub: user.id,
      nickname: user.nickname,
    };
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
