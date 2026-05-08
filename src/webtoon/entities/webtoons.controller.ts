// src/webtoons/webtoons.controller.ts
import { Controller, Get } from '@nestjs/common';
import { NaverCrawlerService } from './naver.service';
import { KakaoCrawlerService } from './kakao.service';

@Controller('webtoons') // 주소 앞에 /webtoons 가 붙습니다.
export class WebtoonController {
  constructor(
    private readonly naverService: NaverCrawlerService,
    private readonly kakaoService: KakaoCrawlerService,
  ) {}

  @Get('naver') // 접속 주소: GET /webtoons/naver
  async getNaver() {
    return await this.naverService.getNaverWebtoons();
  }

  @Get('kakao') // 접속 주소: GET /webtoons/kakao
  async getKakao() {
    return await this.kakaoService.getKakaoWebtoons();
  }
}