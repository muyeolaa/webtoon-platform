// src/webtoons/webtoons.controller.ts
import { Controller, Get, Param, Query } from '@nestjs/common';
import { NaverCrawlerService } from './naver-crawler.service';
import { KakaoCrawlerService } from './kakao-crawler.service';
import { WebtoonService } from './webtoon.service';
import { NaverEpisodeCrawlerService } from './naver-episode-crawler.service';

@Controller('webtoon') // 주소 앞에 /webtoons 가 붙습니다.
export class WebtoonController {
  constructor(
    private readonly naverService: NaverCrawlerService,
    private readonly kakaoService: KakaoCrawlerService,
    private readonly webtoonService: WebtoonService,
    private readonly naverEpisodeCrawler: NaverEpisodeCrawlerService,
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

  @Get('seed-naver-episode/:titleId')
  async seedNaverEpisode(@Param('titleId') titleId: string) {
    // 크롤러 서비스의 함수를 실행!
    return this.naverEpisodeCrawler.seedSingleWebtoonEpisodes(titleId);
  }
  // 🚀 새로 추가할 "전체 수집" 스위치!
  @Get('seed-naver-all')
  async seedAllNaverEpisodes() {
    // 💡 핵심: 앞에 'await'를 일부러 뺐습니다!
    this.naverEpisodeCrawler.seedAllNaverEpisodes();

    // 브라우저에는 즉시 아래 메시지를 던져주고, 크롤링 작업은 뒤에서 묵묵히 돌아갑니다.
    return {
      message:
        '🚀 네이버 웹툰 전체 수집이 백그라운드에서 시작되었습니다! 터미널(콘솔) 로그를 확인하세요.',
    };
  }
}
