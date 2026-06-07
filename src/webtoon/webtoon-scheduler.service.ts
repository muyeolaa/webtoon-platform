// src/webtoon/webtoon-scheduler.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Webtoon } from './entities/webtoon.entity';
import { NaverCrawlerService } from './naver-crawler.service';
import { KakaoCrawlerService } from './kakao-crawler.service';
import { NaverEpisodeCrawlerService } from './naver-episode-crawler.service'; // 🚀 1. 회차 수집기 가져오기!

@Injectable()
export class WebtoonSchedulerService {
  private readonly logger = new Logger(WebtoonSchedulerService.name);

  constructor(
    @InjectRepository(Webtoon)
    private readonly webtoonRepository: Repository<Webtoon>,
    private readonly naverCrawlerService: NaverCrawlerService,
    private readonly kakaoCrawlerService: KakaoCrawlerService,
    // 🚀 2. 회차 수집기를 스케줄러에 주입!
    private readonly naverEpisodeCrawler: NaverEpisodeCrawlerService,
  ) {}

  /**
   * 매일 새벽 3시에 자동 실행 (한국 시간 기준)
   */
  @Cron('0 3 * * *', { timeZone: 'Asia/Seoul' })
  async handleDailyCrawling() {
    this.logger.log('🚀 [Webtoon Auto Bot] 새벽 정기 크롤링을 시작합니다.');

    try {
      // 💡 [핵심 비즈니스 로직]
      this.logger.log('🧹 모든 웹툰의 업데이트(up) 상태를 초기화 중...');
      await this.webtoonRepository.update({ up: true }, { up: false });

      // ====================================================================
      // 1. 네이버 웹툰 데이터 파이프라인 (순서가 매우 중요합니다!)
      // ====================================================================
      this.logger.log('▶️ [네이버 1/4] 연재 웹툰(정규+매일+) 동기화 중...');
      await this.naverCrawlerService.getNaverWebtoons();

      // 🚀 네가 찾아낸 바로 그 부분! (방금 완결된 녀석들을 잡기 위해 앞부분 2페이지만 빠르게 훑기)
      this.logger.log('▶️ [네이버 2/4] 신규 완결 웹툰 확인 중...');
      await this.naverCrawlerService.getFinishedNaverWebtoons(2);

      // 🚀 신작이 들어왔으니 빈칸(상세설명, 장르) 채우기
      this.logger.log('▶️ [네이버 3/4] 신작 상세정보 동기화 중...');
      await this.naverCrawlerService.syncMissingDetails();

      // 🚀 우리가 새로 만든 하이라이트! 오늘 업데이트된 웹툰들의 최신 회차(1페이지) 수집
      this.logger.log('▶️ [네이버 4/4] 최신 회차 데이터 동기화 중...');
      await this.naverEpisodeCrawler.syncUpdatedEpisodes();

      // ====================================================================
      // 2. 카카오 웹툰 파이프라인
      // ====================================================================
      this.logger.log('▶️ [카카오] 카카오 웹툰 데이터 동기화 중...');
      await this.kakaoCrawlerService.getKakaoWebtoons();

      this.logger.log(
        '✅ [Webtoon Auto Bot] 오늘의 웹툰 데이터 동기화가 무사히 완료되었습니다!',
      );
    } catch (error) {
      this.logger.error(
        '❌ [Webtoon Auto Bot] 크롤링 도중 치명적인 에러 발생:',
        error,
      );
    }
  }
}
