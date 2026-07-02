// src/auth/auth.controller.ts
import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthGuard } from '@nestjs/passport';
import type { Request, Response } from 'express';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // 🚪 1. 카카오 로그인 창으로 가는 문
  @Get('kakao')
  @UseGuards(AuthGuard('kakao'))
  async kakaoLogin() {
    // AuthGuard가 알아서 카카오 로그인 화면으로 보내버림!
  }

  // 🎯 2. 카카오 로그인이 끝나고 돌아오는 도착지
  @Get('kakao/callback')
  @UseGuards(AuthGuard('kakao'))
  async kakaoCallback(@Req() req: Request, @Res() res: Response) {
    const user = req.user as any;

    const result = await this.authService.validateSocialUser(
      user.email,
      user.nickname,
      user.provider,
      user.providerId,
    );

    // 🚀 수정됨: 환경변수에서 프론트엔드 주소를 가져옴 (배포용 주소가 없으면 로컬 3001 사용)
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    res.redirect(`${frontendUrl}?token=${result.accessToken}`);
  }

  // 🚪 3. 네이버 로그인 창으로 가는 문
  @Get('naver')
  @UseGuards(AuthGuard('naver'))
  async naverLogin() {
    // 네이버 로그인 화면으로 자동 리다이렉트!
  }

  // 🎯 4. 네이버 로그인이 끝나고 돌아오는 도착지
  @Get('naver/callback')
  @UseGuards(AuthGuard('naver'))
  async naverCallback(@Req() req: Request, @Res() res: Response) {
    const user = req.user as any;

    const result = await this.authService.validateSocialUser(
      user.email,
      user.nickname,
      user.provider,
      user.providerId,
    );

    // 🚀 수정됨: 프론트엔드 주소 동적 할당
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    res.redirect(`${frontendUrl}?token=${result.accessToken}`);
  }

  // 🚪 5. 구글 로그인 창으로 가는 문
  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleLogin() {
    // 구글 로그인 창으로 슝!
  }

  // 🎯 6. 구글 로그인이 끝나고 돌아오는 도착지
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    const user = req.user as any;

    const result = await this.authService.validateSocialUser(
      user.email,
      user.nickname,
      user.provider,
      user.providerId,
    );

    // 🚀 수정됨: 프론트엔드 주소 동적 할당
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    res.redirect(`${frontendUrl}?token=${result.accessToken}`);
  }
}
