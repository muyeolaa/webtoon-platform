// src/auth/auth.controller.ts
import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthGuard } from '@nestjs/passport';
import type { Request, Response } from 'express';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // 🚪 1. 카카오 로그인 창으로 가는 문
  // 프론트엔드에서 <a href="http://localhost:3000/auth/kakao">카카오 로그인</a> 을 누르면 여기로 와!
  @Get('kakao')
  @UseGuards(AuthGuard('kakao'))
  async kakaoLogin() {
    // AuthGuard가 알아서 카카오 로그인 화면으로 보내버리기 때문에
    // 이 함수 안에는 아무 코드도 적을 필요가 없어! 완전 편리하지?
  }

  // 🎯 2. 카카오 로그인이 끝나고 돌아오는 도착지 (아까 등록한 Redirect URI!)
  @Get('kakao/callback')
  @UseGuards(AuthGuard('kakao'))
  async kakaoCallback(@Req() req: Request, @Res() res: Response) {
    // 1. KakaoStrategy를 무사히 통과하고 뽑아낸 유저 정보가 req.user에 예쁘게 담겨있어.
    const user = req.user as any;

    // 2. 우리가 아까 auth.service.ts에 만든 만능 키 함수에 정보를 던져주기 (DB 저장 + JWT 발급)
    const result = await this.authService.validateSocialUser(
      user.email,
      user.nickname,
      user.provider,
      user.providerId,
    );

    // 3. 🚀 프론트엔드(localhost:3001)로 유저를 다시 돌려보내면서, URL 뒤에 JWT 토큰을 달아서 보내주기!
    // (프론트엔드는 이 주소로 떨어지면 URL에서 토큰만 쏙 빼서 로컬 스토리지에 저장하면 로그인 끝이야!)
    res.redirect(`http://localhost:3001?token=${result.accessToken}`);
  }
}
