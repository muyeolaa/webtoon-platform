// src/webtoon/bookmark/bookmark.controller.ts
import { Controller, Post, Param, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard'; // 🚀 우리가 만든 보안 요원
import { BookmarkService } from './bookmark.service';

@Controller('webtoon') // 기본 주소: /webtoons
export class BookmarkController {
  constructor(private readonly bookmarkService: BookmarkService) {}

  // 🚀 JWT 보안 스티커 부착! 로그인 안 한 사람은 접근 불가
  @UseGuards(JwtAuthGuard)
  @Post(':id/bookmark') // 상세 주소: /webtoons/:id/bookmark
  async toggleBookmark(
    @Req() req, // 보안 요원이 넣어준 유저 정보 꺼내기
    @Param('id') webtoonId: string, // 주소창의 :id 값 꺼내기 (문자열!)
  ) {
    // req.user 에는 방금 로그인한 유저의 정보가 완벽하게 들어있어!
    return this.bookmarkService.toggleBookmark(req.user, webtoonId);
  }
}
