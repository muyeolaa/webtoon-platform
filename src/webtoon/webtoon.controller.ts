// src/webtoon/webtoon.controller.ts
import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { NaverCrawlerService } from './naver-crawler.service';
import { KakaoCrawlerService } from './kakao-crawler.service';
import { WebtoonService } from './webtoon.service';
import { NaverEpisodeCrawlerService } from './naver-episode-crawler.service';
import { WebtoonSchedulerService } from './webtoon-scheduler.service';

@Controller('webtoon') // 주소 앞에 /webtoon 이 붙습니다.
export class WebtoonController {
  constructor(
    private readonly naverService: NaverCrawlerService,
    private readonly kakaoService: KakaoCrawlerService,
    private readonly webtoonService: WebtoonService,
    private readonly naverEpisodeCrawler: NaverEpisodeCrawlerService,
    private readonly webtoonSchedulerService: WebtoonSchedulerService,
  ) {}

  @Get('naver') // 접속 주소: GET /webtoon/naver
  async getNaver() {
    return await this.naverService.getNaverWebtoons();
  }

  @Get('kakao') // 접속 주소: GET /webtoon/kakao
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

  // =========================================================================
  // 🚀 회차 데이터 선택 수집 (maxPage 옵션 추가)
  // =========================================================================
  @Get('seed-naver-episode/:titleId')
  async seedNaverEpisode(
    @Param('titleId') titleId: string,
    @Query('maxPage') maxPage?: string,
  ) {
    // 포스트맨에서 ?maxPage=1 처럼 주면 1페이지만, 안 주면 999(전체)를 긁어옵니다.
    const limit = maxPage ? parseInt(maxPage, 10) : 999;
    return await this.naverEpisodeCrawler.seedSingleWebtoonEpisodes(
      titleId,
      limit,
    );
  }

  //  전체 수집 스위치
  @Get('seed-naver-all')
  async seedAllNaverEpisodes(
    @Query('force') force?: string,
    @Query('start') start?: string,
  ) {
    // 주소창에 ?force=true 가 있으면 강제 업데이트(Upsert) 모드로 변신합니다.
    const isForceUpdate = force === 'true';
    const startNumber = start ? Number(start) : 1;

    // 💡 핵심: 앞에 'await'를 일부러 뺐습니다! (백그라운드 실행)
    // 서비스 함수에 isForceUpdate 값을 넘겨줍니다.
    this.naverEpisodeCrawler.seedAllNaverEpisodes(isForceUpdate, startNumber);

    // 브라우저에는 즉시 아래 메시지를 던져주고, 크롤링 작업은 뒤에서 묵묵히 돌아갑니다.
    return {
      message: `🚀 네이버 웹툰 전체 수집이 백그라운드에서 시작되었습니다!`,
      mode: isForceUpdate
        ? '🚨 강제 덮어쓰기 모드 (전수 조사)'
        : '⏩ 일반 모드 (기존 데이터 스킵)',
      startPoint: `${startNumber}번 웹툰부터 수집 시작`, // 확인용 메시지 추가
      notice: '터미널(콘솔) 로그를 확인하세요.',
    };
  }

  @Get(':id')
  async getWebtoonDetail(@Param('id') id: string) {
    return await this.webtoonService.getWebtoonDetail(id);
  }

  // 웹툰 상세정보, 해시태크 수집
  @Post('sync-naver-details')
  async syncNaverDetails() {
    this.naverService.syncMissingDetails();
    return { message: '시작됨' };
  }

  //완결 웹툰 데이터수집
  @Post('sync-naver-finished')
  async syncNaverFinished(@Query('maxPage') maxPage?: string) {
    // 포스트맨에서 주소창 뒤에 ?maxPage=5 처럼 값을 주면 그만큼만 수집하고,
    // 아무 값도 안 주면 기본값으로 999페이지(전체 싹쓸이)를 수집하도록 설정합니다!
    const limit = maxPage ? parseInt(maxPage, 10) : 999;

    // 서비스의 함수를 호출하면서 limit 값을 넘겨줍니다.
    return await this.naverService.getFinishedNaverWebtoons(limit);
  }

  // =========================================================================
  // 🚀 매일 새벽용: 오늘 업데이트된 웹툰의 최신 회차(1페이지)만 쏙쏙 수집 스위치
  // =========================================================================
  @Post('sync-naver-updated-episodes')
  async syncNaverUpdatedEpisodes() {
    // 1페이지만 긁어오는 거라 금방 끝나니까, 결과를 포스트맨 화면에서 바로 볼 수 있게 await를 걸어둡니다.
    return await this.naverEpisodeCrawler.syncUpdatedEpisodes();
  }

  @Post('run-scheduler')
  async runSchedulerManually() {
    // 💡 전체 과정이 오래 걸리니까, 브라우저/포스트맨이 멈추지 않도록 'await'를 뺐어! (백그라운드 실행)
    this.webtoonSchedulerService.handleDailyCrawling();

    return {
      message:
        '🚀 [Webtoon Auto Bot] 데일리 스케줄러가 백그라운드에서 강제 실행되었습니다!',
      notice: '자세한 진행 상황은 터미널 로그를 확인해 주세요.',
    };
  }
}
