// src/user/user.controller.ts
import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard'; // 🚀 우리가 만든 보안 요원 호출!

@Controller('user')
export class UserController {
  // 🚀 이 API 대문에 보안 요원(Guard) 스티커 부착!
  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@Req() req) {
    // 보안 요원이 깐깐한 검사를 통과한 사람의 정보를 `req.user`에 예쁘게 담아줬어!
    // 우리는 그냥 그걸 프론트한테 던져주기만 하면 끝이야. 개꿀이지?
    return {
      message: '보안 구역 통과 성공!',
      user: req.user,
    };
  }
}
