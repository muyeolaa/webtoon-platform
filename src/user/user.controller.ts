// src/user/user.controller.ts
import { Controller, Get, Patch, Body, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard'; // 🚀 우리가 만든 보안 요원
import { UserService } from './user.service'; // 🚀 방금 만든 서비스 호출!

@Controller('user')
export class UserController {
  // 💡 컨트롤러가 서비스를 사용할 수 있도록 연결 (의존성 주입)
  constructor(private readonly userService: UserService) {}

  // 기존 프로필 확인 API (보안 요원 부착)
  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@Req() req) {
    return {
      message: '보안 구역 통과 성공!',
      user: req.user,
    };
  }

  // 🚀 새로 추가된 닉네임 변경 API (이것도 당연히 보안 요원 부착!)
  @UseGuards(JwtAuthGuard)
  @Patch('nickname')
  async updateNickname(@Req() req, @Body('nickname') nickname: string) {
    // 보안 요원이 검사 완료한 내 고유 ID (req.user.sub 또는 req.user.id)
    const userId = req.user.id || req.user.sub;

    // 서비스 파일의 마법의 함수 실행!
    return await this.userService.updateNickname(userId, nickname);
  }
}
