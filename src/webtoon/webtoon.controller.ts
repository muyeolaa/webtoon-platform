// src/webtoons/webtoons.controller.ts
import { Controller, Get, Query } from '@nestjs/common';
import { NaverCrawlerService } from './naver-crawler.service';
import { KakaoCrawlerService } from './kakao-crawler.service';
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
  async getList(
    @Query('page') page: string,
    @Query('limit') limit: string,
    @Query('platform') platform?: string,
    @Query('day') day?: string,
    @Query('sort') sort?: string,
    @Query('search') search?: string,
  ) {
    const pageNum = Number(page) || 1;
    const limitNum = Number(limit) || 21;

    // 서비스에게 받은 파라미터를 전부 토스해줍니다!
    return await this.webtoonService.getPaginatedWebtoons(
      pageNum,
      limitNum,
      platform,
      day,
      sort,
      search,
    );
  }
}
