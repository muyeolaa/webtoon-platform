// src/user/user.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entity/user.entity'; // 💡 본인의 entity 경로에 맞게 확인!
import { JwtService } from '@nestjs/jwt'; // 🚀 새 토큰 발급기!

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private jwtService: JwtService,
  ) {}

  // 👤 닉네임 변경 & 새 토큰 발급 로직
  async updateNickname(userId: number, newNickname: string) {
    // 1. 중복 닉네임 검사 (선택사항이지만 에러 방지를 위해 추가!)
    const existUser = await this.userRepository.findOne({
      where: { nickname: newNickname },
    });
    if (existUser && existUser.id !== userId) {
      throw new BadRequestException('이미 사용 중인 닉네임입니다.');
    }

    // 2. DB에 새 닉네임 업데이트
    await this.userRepository.update(userId, { nickname: newNickname });

    // 3. 업데이트된 최신 내 정보 가져오기
    const updatedUser = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!updatedUser) {
      throw new BadRequestException('유저 정보를 찾을 수 없습니다.');
    }

    // 4. 🚀 [핵심] 바뀐 닉네임이 박힌 "새로운 JWT 토큰" 생성!
    const payload = {
      email: updatedUser.email,
      sub: updatedUser.id,
      nickname: updatedUser.nickname,
    };
    const newAccessToken = this.jwtService.sign(payload);

    return {
      message: '닉네임 변경 완료!',
      accessToken: newAccessToken, // 🚀 프론트엔드가 이 토큰으로 갈아끼울 예정!
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        nickname: updatedUser.nickname,
        role: updatedUser.role,
      },
    };
  }
}
