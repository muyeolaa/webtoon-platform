// src/webtoon/webtoon-scheduler.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Webtoon } from './entities/webtoon.entity';
import { NaverCrawlerService } from './naver-crawler.service';
import { KakaoCrawlerService } from './kakao-crawler.service';

@Injectable()
export class WebtoonSchedulerService {
  private readonly logger = new Logger(WebtoonSchedulerService.name);

  constructor(
    // 상태 초기화를 위해 스케줄러에도 DB 마스터키(Repository)를 쥐어줍니다.
    @InjectRepository(Webtoon)
    private readonly webtoonRepository: Repository<Webtoon>,
    private readonly naverCrawlerService: NaverCrawlerService,
    private readonly kakaoCrawlerService: KakaoCrawlerService,
  ) {}

  /**
   * 매일 새벽 3시에 자동 실행 (한국 시간 기준)
   */
  @Cron('0 3 * * *', { timeZone: 'Asia/Seoul' })
  async handleDailyCrawling() {
    this.logger.log('🚀 [Webtoon Auto Bot] 새벽 정기 크롤링을 시작합니다.');

    try {
      // 💡 [핵심 비즈니스 로직]
      // 크롤링 시작 전, 모든 웹툰의 업데이트(up) 상태를 일괄 false로 초기화합니다.
      // 이렇게 해야 오늘 새롭게 크롤링되면서 up: true로 들어온 데이터만 정확히 남습니다.
      this.logger.log('🧹 모든 웹툰의 업데이트(up) 상태를 초기화 중...');
      await this.webtoonRepository.update({}, { up: false });

      // 1. 네이버 크롤링 (순차 실행)
      this.logger.log('▶️ 네이버 웹툰 데이터 동기화 중...');
      await this.naverCrawlerService.getNaverWebtoons();

      // 2. 카카오 크롤링 (순차 실행)
      this.logger.log('▶️ 카카오 웹툰 데이터 동기화 중...');
      await this.kakaoCrawlerService.getKakaoWebtoons();

      this.logger.log(
        '✅ [Webtoon Auto Bot] 오늘의 웹툰 데이터 동기화가 무사히 완료되었습니다!',
      );
    } catch (error) {
      // 스케줄러가 죽지 않도록 안전망(try-catch) 구축
      this.logger.error(
        '❌ [Webtoon Auto Bot] 크롤링 도중 치명적인 에러 발생:',
        error,
      );
    }
  }
}
