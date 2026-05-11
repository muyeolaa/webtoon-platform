// src/webtoons/webtoons.controller.ts
import { Controller, Get } from '@nestjs/common';
import { NaverCrawlerService } from './naver.service';
import { KakaoCrawlerService } from './kakao.service';
import { WebtoonService } from './webtoon.service';

@Controller('webtoon') // 주소 앞에 /webtoons 가 붙습니다.
export class WebtoonController {
  constructor(
    private readonly naverService: NaverCrawlerService,
    private readonly kakaoService: KakaoCrawlerService,
    private readonly webtoonService: WebtoonService,
  ) {}

  @Get('naver') // 접속 주소: GET /webtoons/naver
  async getNaver() {
    return await this.naverService.getNaverWebtoons();
  }

  @Get('kakao') // 접속 주소: GET /webtoons/kakao
  async getKakao() {
    return await this.kakaoService.getKakaoWebtoons();
  }

  @Get('list')
  async getWebtoonList() {
    // 매니저에게 "다 가져와!" 시키고, 그 결과를 바로 손님(브라우저)에게 던져줍니다.
    return await this.webtoonService.findAllWebtoons();
  }  
}