// src/webtoon/webtoon-scheduler.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Webtoon } from './entities/webtoon.entity';
import { NaverCrawlerService } from './naver-crawler.service';
import { KakaoCrawlerService } from './kakao-crawler.service';
import { NaverEpisodeCrawlerService } from './naver-episode-crawler.service';
import { KakaoEpisodeCrawlerService } from './kakao-episode-crawler.service';
// 🚀 1. 레진코믹스 수집기 임포트!
import { LezhinCrawlerService } from './lezhin-crawler.service';
import { LezhinEpisodeCrawlerService } from './lezhin-episode-crawler.service';

@Injectable()
export class WebtoonSchedulerService {
  private readonly logger = new Logger(WebtoonSchedulerService.name);

  constructor(
    @InjectRepository(Webtoon)
    private readonly webtoonRepository: Repository<Webtoon>,
    private readonly naverCrawlerService: NaverCrawlerService,
    private readonly kakaoCrawlerService: KakaoCrawlerService,
    private readonly naverEpisodeCrawler: NaverEpisodeCrawlerService,
    private readonly kakaoEpisodeCrawler: KakaoEpisodeCrawlerService,
    // 🚀 2. 레진코믹스 의존성 주입!
    private readonly lezhinCrawlerService: LezhinCrawlerService,
    private readonly lezhinEpisodeCrawlerService: LezhinEpisodeCrawlerService,
  ) {}

  /**
   * 매일 새벽 3시에 자동 실행 (한국 시간 기준)
   */
  @Cron('0 3 * * *', { timeZone: 'Asia/Seoul' })
  async handleDailyCrawling() {
    this.logger.log('🚀 [Webtoon Auto Bot] 새벽 정기 크롤링을 시작합니다.');

    try {
      this.logger.log('🧹 모든 웹툰의 업데이트(up) 상태를 초기화 중...');
      await this.webtoonRepository.update({ up: true }, { up: false });

      // ====================================================================
      // 1. 네이버 웹툰 데이터 파이프라인
      // ====================================================================
      this.logger.log('▶️ [네이버 1/4] 연재 웹툰(정규+매일+) 동기화 중...');
      await this.naverCrawlerService.getNaverWebtoons();

      this.logger.log('▶️ [네이버 2/4] 신규 완결 웹툰 확인 중...');
      await this.naverCrawlerService.getFinishedNaverWebtoons(2);

      this.logger.log('▶️ [네이버 3/4] 신작 상세정보 동기화 중...');
      await this.naverCrawlerService.syncMissingDetails();

      this.logger.log('▶️ [네이버 4/4] 최신 회차 데이터 동기화 중...');
      await this.naverEpisodeCrawler.syncUpdatedEpisodes();

      // ====================================================================
      // 2. 카카오 웹툰 파이프라인
      // ====================================================================
      this.logger.log('▶️ [카카오 1/3] 연재/완결 리스트 동기화 중...');
      await this.kakaoCrawlerService.getKakaoWebtoons();

      this.logger.log(
        '▶️ [카카오 2/3] 신작(상세설명 누락) 상세정보 및 회차 동기화 중...',
      );
      await this.kakaoEpisodeCrawler.syncMissingDetails();

      this.logger.log('▶️ [카카오 3/3] 오늘 연재작 최신 회차 동기화 중...');
      await this.kakaoEpisodeCrawler.syncUpdatedEpisodes();

      // ====================================================================
      // 🚀 3. 레진코믹스 웹툰 파이프라인 추가!
      // ====================================================================
      this.logger.log('▶️ [레진 1/2] 전체 연재/완결 리스트 최신화 중...');
      await this.lezhinCrawlerService.getLezhinWebtoons();

      this.logger.log(
        '▶️ [레진 2/2] 스마트 상세/회차 동기화 중 (신작 & 오늘 연재작)...',
      );
      await this.lezhinEpisodeCrawlerService.syncSmartLezhinEpisodes();

      this.logger.log(
        '✅ [Webtoon Auto Bot] 오늘의 네이버, 카카오, 레진코믹스 데이터 동기화가 무사히 완료되었습니다!',
      );
    } catch (error) {
      this.logger.error(
        '❌ [Webtoon Auto Bot] 크롤링 도중 치명적인 에러 발생:',
        error,
      );
    }
  }
}
