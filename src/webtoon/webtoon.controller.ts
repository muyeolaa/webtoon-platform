// src/webtoon/webtoon.controller.ts
import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { NaverCrawlerService } from './naver-crawler.service';
import { KakaoCrawlerService } from './kakao-crawler.service';
import { WebtoonService } from './webtoon.service';
import { NaverEpisodeCrawlerService } from './naver-episode-crawler.service';
import { WebtoonSchedulerService } from './webtoon-scheduler.service';
import { KakaoEpisodeCrawlerService } from './kakao-episode-crawler.service';

@Controller('webtoon') // 주소 앞에 /webtoon 이 붙습니다.
export class WebtoonController {
  constructor(
    private readonly naverService: NaverCrawlerService,
    private readonly kakaoService: KakaoCrawlerService,
    private readonly webtoonService: WebtoonService,
    private readonly naverEpisodeCrawler: NaverEpisodeCrawlerService,
    private readonly webtoonSchedulerService: WebtoonSchedulerService,
    private readonly kakaoEpisodeCrawler: KakaoEpisodeCrawlerService,
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

  // 회차 데이터가 없는 웹툰만 골라서 데이터 받아오기
  @Get('seed-naver-missing')
  async seedNaverMissingEpisodes() {
    // 💡 누락된 웹툰이 많을 경우 시간이 꽤 걸릴 수 있으므로 'await'를 빼서 백그라운드로 돌립니다.
    this.naverEpisodeCrawler.seedMissingEpisodes();

    // 브라우저/포스트맨에는 즉각적으로 아래 메시지만 던져줍니다.
    return {
      message:
        '🚀 누락된(19금 등) 네이버 웹툰 회차 재수집이 백그라운드에서 시작되었습니다!',
      notice:
        '서버 터미널 로그를 보시면 어떤 웹툰의 19금 회차들을 뚫어내고 있는지 실시간으로 확인할 수 있습니다.',
    };
  }

  @Get('seed-kakao-episode/:titleId')
  async seedKakaoEpisode(@Param('titleId') titleId: string) {
    // 결과를 포스트맨에서 바로 볼 수 있게 await를 걸어둡니다.
    return await this.kakaoEpisodeCrawler.seedKakaoEpisodes(titleId);
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

  @Post('seed-naver-adult-episodes')
  async seedNaverAdultEpisodes() {
    // 💡 19금 웹툰이 많을 수 있으니, 브라우저가 멈추지 않게 백그라운드로 실행합니다 (await 뺌)
    this.naverEpisodeCrawler.seedAdultWebtoonEpisodes();

    return {
      message: '🔞 19금 성인 웹툰 회차 재수집이 백그라운드에서 시작되었습니다!',
      notice: '서버 터미널 로그를 확인해 주세요.',
    };
  }

  // =========================================================================
  // 🚀 카카오 전체 회차 싹쓸이 스위치 (이어하기 기능 지원)
  // =========================================================================
  @Post('seed-kakao-all-episodes')
  async seedKakaoAllEpisodes(@Query('start') start?: string) {
    // 포스트맨에서 ?start=150 을 보내면 150으로, 안 보내면 0으로 세팅합니다.
    const startIndex = start ? parseInt(start, 10) : 0;

    // 백그라운드 실행
    this.kakaoEpisodeCrawler.seedAllKakaoEpisodes(startIndex);

    return {
      message: `🚀 카카오 웹툰 회차 수집이 ${startIndex}번째 웹툰부터 백그라운드에서 시작되었습니다!`,
      notice:
        '터미널 로그를 확인하세요. 중간에 멈추면 해당 번호를 기억했다가 ?start=번호 로 이어하기가 가능합니다.',
    };
  }
}
