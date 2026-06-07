import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { Episode } from './entities/episode.entity';
import { Webtoon } from './entities/webtoon.entity';

// 1초 휴식용 수면제 함수
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

@Injectable()
export class NaverEpisodeCrawlerService {
  constructor(
    @InjectRepository(Episode)
    private readonly episodeRepository: Repository<Episode>,
    @InjectRepository(Webtoon)
    private readonly webtoonRepository: Repository<Webtoon>,
  ) {}

  // =========================================================================
  // 🟢 1. 단일 웹툰 회차 수집기 (최초 싹쓸이 & 1페이지 빠른 업데이트 겸용)
  // =========================================================================
  // 🚀 수정: maxPage 파라미터를 추가해서, 원할 때는 1페이지만 긁고 빠질 수 있게 만듭니다!
  async seedSingleWebtoonEpisodes(titleId: string, maxPage: number = 999) {
    let currentPage = 1;
    let totalPages = 1;

    const parentWebtoon = await this.webtoonRepository.findOne({
      where: { id: `naver_${titleId}` },
    });

    if (!parentWebtoon) {
      console.error(
        `❌ DB에서 부모 웹툰(naver_${titleId})을 찾을 수 없습니다.`,
      );
      return false;
    }

    console.log(`🚀 [네이버] ${titleId} 웹툰 회차 수집 시작...`);

    do {
      try {
        const url = `https://comic.naver.com/api/article/list?titleId=${titleId}&page=${currentPage}`;
        const response = await fetch(url);
        const data = await response.json();

        // 🚀 핵심: API가 알려준 전체 페이지와 우리가 제한한 maxPage 중 더 작은 값을 씁니다.
        // (maxPage가 1이면 무조건 1페이지에서 끝남!)
        totalPages = Math.min(data.pageInfo?.totalPages || 1, maxPage);

        // 무료와 유료(미리보기) 회차 합치기
        const freeArticles = data.articleList || [];
        const chargeArticles = data.chargeFolderArticleList || [];
        const allArticles = [...freeArticles, ...chargeArticles];

        // DB Entity 규격에 맞게 매핑
        const episodesToSave = allArticles.map((article) => ({
          titleId: titleId,
          episodeNo: article.no,
          title: article.subtitle,
          thumbnailUrl: article.thumbnailUrl,
          uploadDate: article.serviceDateDescription,
          webtoon: parentWebtoon,
        }));

        // 덮어쓰기 (Upsert)
        await this.episodeRepository.upsert(episodesToSave, [
          'titleId',
          'episodeNo',
        ]);

        console.log(
          `✅ [네이버 ${titleId}] ${currentPage}/${totalPages} 페이지 저장 완료!`,
        );

        currentPage++;
        if (currentPage <= totalPages) {
          await sleep(1000);
        }
      } catch (error) {
        console.error(
          `❌ [네이버 ${titleId}] ${currentPage}페이지 수집 에러:`,
          (error as Error).message,
        );
        break;
      }
    } while (currentPage <= totalPages);

    console.log(`🎉 [네이버] ${titleId} 웹툰 회차 수집 완료!`);
    return true;
  }

  // =========================================================================
  // 🟢 2. 최초 1회용: 전체 웹툰 모든 회차 싹쓸이 로직 (기존 유지)
  // =========================================================================
  async seedAllNaverEpisodes(
    forceUpdate: boolean = false,
    startNumber: number = 1,
  ) {
    const naverWebtoons = await this.webtoonRepository.find({
      where: { id: Like('naver_%') },
      order: { id: 'ASC' },
    });

    console.log(
      `🔥 총 ${naverWebtoons.length}개의 네이버 웹툰 전체 수집 시작!`,
    );

    const failedWebtoons: string[] = [];
    const startIndex = startNumber > 0 ? startNumber - 1 : 0;

    for (let i = startIndex; i < naverWebtoons.length; i++) {
      const webtoon = naverWebtoons[i];
      const numericTitleId = webtoon.id.replace('naver_', '');

      const existingEpisodeCount = await this.episodeRepository.count({
        where: { titleId: numericTitleId },
      });

      if (!forceUpdate && existingEpisodeCount > 0) {
        console.log(
          `⏩ [${i + 1}/${naverWebtoons.length}] 이미 수집되어 건너뜁니다!`,
        );
        continue;
      }

      console.log(
        `\n▶️ [${i + 1}/${naverWebtoons.length}] 웹툰(API ID: ${numericTitleId}) 수집 시작...`,
      );

      const isSuccess = await this.seedSingleWebtoonEpisodes(numericTitleId);

      if (!isSuccess) failedWebtoons.push(numericTitleId);

      await sleep(1000); // 전체 수집 시 안전을 위해 1초 대기
    }

    if (failedWebtoons.length > 0) {
      console.log(`🚨 에러 발생 ID 목록:`, failedWebtoons);
    } else {
      console.log(`✨ 완벽하게 모두 수집되었습니다.`);
    }

    return { message: '전체 수집 완료!' };
  }

  // =========================================================================
  // 🚀 3. 매일 새벽용: 오늘 업데이트된 웹툰만 골라 "최신 1페이지"만 수집!
  // =========================================================================
  async syncUpdatedEpisodes() {
    // 1. DB에서 오늘 업데이트된(up: true) 네이버 웹툰만 찾아냅니다.
    const updatedWebtoons = await this.webtoonRepository.find({
      where: { platform: 'naver', up: true },
    });

    console.log(
      `👀 오늘 업데이트된 네이버 웹툰 ${updatedWebtoons.length}개의 최신 회차를 수집합니다.`,
    );

    if (updatedWebtoons.length === 0) {
      return { message: '오늘 업데이트된 웹툰이 없습니다.' };
    }

    let successCount = 0;

    for (const webtoon of updatedWebtoons) {
      const numericTitleId = webtoon.id.replace('naver_', '');

      // 2. 단일 수집기를 호출하되, maxPage를 '1'로 설정하여 1페이지만 빠르게 긁고 빠집니다!
      const isSuccess = await this.seedSingleWebtoonEpisodes(numericTitleId, 1);

      if (isSuccess) successCount++;

      // 3. IP 차단 방지용 1초 휴식
      await sleep(1000);
    }

    console.log(
      `🎉 업데이트 회차 1페이지 동기화 완료! (성공: ${successCount}/${updatedWebtoons.length})`,
    );

    return {
      message: '업데이트 회차 동기화 완료',
      targetCount: updatedWebtoons.length,
      successCount,
    };
  }
}
