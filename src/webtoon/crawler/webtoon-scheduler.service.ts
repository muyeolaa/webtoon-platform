// src/webtoon/webtoon-scheduler.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Webtoon } from '../entities/webtoon.entity';
import { NaverCrawlerService } from './naver-crawler.service';
import { KakaoCrawlerService } from './kakao-crawler.service';
import { NaverEpisodeCrawlerService } from './naver-episode-crawler.service';
import { KakaoEpisodeCrawlerService } from './kakao-episode-crawler.service';
import { LezhinCrawlerService } from './lezhin-crawler.service';
import { LezhinEpisodeCrawlerService } from './lezhin-episode-crawler.service';

// 🚀 1. 랭킹 정산을 위한 엔티티 추가 임포트!
import { Bookmark } from '../entities/bookmark.entity';
import { Rating } from '../entities/rating.entity';

@Injectable()
export class WebtoonSchedulerService {
  private readonly logger = new Logger(WebtoonSchedulerService.name);

  constructor(
    @InjectRepository(Webtoon)
    private readonly webtoonRepository: Repository<Webtoon>,

    // 🚀 2. 랭킹 정산용 레포지토리 주입 추가!
    @InjectRepository(Bookmark)
    private readonly bookmarkRepository: Repository<Bookmark>,
    @InjectRepository(Rating)
    private readonly ratingRepository: Repository<Rating>,

    private readonly naverCrawlerService: NaverCrawlerService,
    private readonly kakaoCrawlerService: KakaoCrawlerService,
    private readonly naverEpisodeCrawler: NaverEpisodeCrawlerService,
    private readonly kakaoEpisodeCrawler: KakaoEpisodeCrawlerService,
    private readonly lezhinCrawlerService: LezhinCrawlerService,
    private readonly lezhinEpisodeCrawlerService: LezhinEpisodeCrawlerService,
  ) {}

  /**
   * 매일 밤 23:30(KST) 실행. 네이버 → 카카오 → 레진 순으로 플랫폼별 수집을 끝낸 뒤
   * 마지막에 syncAllRankings()를 호출한다 - 랭킹이 조회수/북마크/별점을 기준으로 하므로
   * 최신 데이터가 다 반영된 다음에 계산해야 순위가 정확하다.
   */
  @Cron('30 23 * * *', { timeZone: 'Asia/Seoul' })
  async handleDailyCrawling() {
    this.logger.log('🚀 [Webtoon Auto Bot] 새벽 정기 배치 작업을 시작합니다.');

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
      this.logger.log('▶️ [카카오 2/3] 신작 상세정보 및 회차 동기화 중...');
      await this.kakaoEpisodeCrawler.syncMissingDetails();
      this.logger.log('▶️ [카카오 3/3] 오늘 연재작 최신 회차 동기화 중...');
      await this.kakaoEpisodeCrawler.syncUpdatedEpisodes();

      // ====================================================================
      // 3. 레진코믹스 웹툰 파이프라인
      // ====================================================================
      this.logger.log('▶️ [레진 1/2] 전체 연재/완결 리스트 최신화 중...');
      await this.lezhinCrawlerService.getLezhinWebtoons();
      this.logger.log('▶️ [레진 2/2] 스마트 상세/회차 동기화 중...');
      await this.lezhinEpisodeCrawlerService.syncSmartLezhinEpisodes();

      // ====================================================================
      // 🚀 4. 최종 랭킹/별점 정산 파이프라인 (크롤링이 끝난 직후 실행!)
      // ====================================================================
      this.logger.log(
        '▶️ [통합 랭킹 1/1] 전체 웹툰 별점/북마크/인기 점수 정산 중...',
      );
      await this.syncAllRankings();

      this.logger.log(
        '✅ [Webtoon Auto Bot] 오늘의 데이터 동기화 및 랭킹 정산이 무사히 완료되었습니다!',
      );
    } catch (error) {
      this.logger.error(
        '❌ [Webtoon Auto Bot] 배치 작업 도중 치명적인 에러 발생:',
        error,
      );
    }
  }

  // ====================================================================
  // 🚀 새로 추가된 랭킹 정산 전용 내부 함수
  // ====================================================================
  private async syncAllRankings() {
    const webtoons = await this.webtoonRepository.find();
    const now = new Date();

    for (const webtoon of webtoons) {
      try {
        // 1. 진짜 북마크 수 계산
        const realBookmarkCount = await this.bookmarkRepository.count({
          where: { webtoon: { id: webtoon.id } },
        });

        // 2. 진짜 유저들의 별점 계산
        const ratingResult = await this.ratingRepository
          .createQueryBuilder('rating')
          .select('SUM(rating.score)', 'sum')
          .addSelect('COUNT(rating.id)', 'count')
          .where('rating.webtoon_id = :webtoonId', { webtoonId: webtoon.id })
          .getRawOne();

        const realUserSum = Number(ratingResult.sum || 0);
        const realUserCount = Number(ratingResult.count || 0);

        // 3. 가상 유저 100명 공식 (베이지안 평균 방식) - 평가자 1~2명짜리 신작이
        // 별점 5점 받고 바로 랭킹 최상단에 뜨는 왜곡을 막기 위해 크롤링 시점 starScore를
        // "가상 유저 100명 점수"로 가정해 합산한다. 실제 평가자가 늘수록 영향력은 자연히 줄어든다.
        const VIRTUAL_USER_COUNT = 100;
        const virtualSum = Number(webtoon.starScore) * VIRTUAL_USER_COUNT;
        const finalAverage =
          (virtualSum + realUserSum) / (VIRTUAL_USER_COUNT + realUserCount);
        const calculatedRating = Math.round(finalAverage * 100) / 100;

        // 4. 최신성 가중치 보너스
        // (방금 위에서 크롤러가 최신 날짜로 갱신해 줬기 때문에 정확도 100%!)
        let recencyBonus = 0;
        if (webtoon.lastEpisodeUpdatedAt) {
          const diffTime = Math.abs(
            now.getTime() - webtoon.lastEpisodeUpdatedAt.getTime(),
          );
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          if (diffDays <= 3) {
            recencyBonus = 500;
          }
        }

        // 5. 트렌딩 점수 계산
        const viewScore = (webtoon.viewCount || 0) * 1;
        const bookmarkScore = realBookmarkCount * 10;
        const ratingScore = calculatedRating * 50;
        const totalTrendingScore =
          viewScore + bookmarkScore + ratingScore + recencyBonus;

        // 6. 한 번에 업데이트
        await this.webtoonRepository.update(webtoon.id, {
          bookmarkCount: realBookmarkCount,
          starRating: calculatedRating,
          trendingScore: totalTrendingScore,
        });
      } catch (error: any) {
        this.logger.error(
          `❌ [${webtoon.titleName}] 점수 정산 중 오류:`,
          error.message,
        );
      }
    }
  }
}
