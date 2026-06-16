import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { Episode } from '../entities/episode.entity';
import { Webtoon } from '../entities/webtoon.entity';

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
  // 🟢 1. 단일 웹툰 회차 수집기 (19+ 쿠키 장착 완료!)
  // =========================================================================
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

    // 🚀 쿠키 및 브라우저 위장 헤더 세팅
    const headers: Record<string, string> = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    };

    const nidAut = process.env.NAVER_NID_AUT;
    const nidSes = process.env.NAVER_NID_SES;

    if (nidAut && nidSes) {
      headers['Cookie'] = `NID_AUT=${nidAut}; NID_SES=${nidSes};`;
    }

    do {
      try {
        const url = `https://comic.naver.com/api/article/list?titleId=${titleId}&page=${currentPage}`;

        const response = await fetch(url, { headers });
        const text = await response.text(); // 🚀 바로 JSON으로 바꾸지 않고 텍스트로 먼저 받습니다.

        let data;
        try {
          data = JSON.parse(text); // 🚀 19금에 막혀 HTML이 오면 여기서 에러가 발생합니다.
        } catch (parseError) {
          console.error(
            `🚨 [19금 장벽 감지] ${titleId} 웹툰 수집 실패! .env 쿠키가 없거나 만료되었습니다.`,
          );
          return false; // 서버 터지지 않게 부드럽게 종료
        }

        totalPages = Math.min(data.pageInfo?.totalPages || 1, maxPage);

        const freeArticles = data.articleList || [];
        const chargeArticles = data.chargeFolderArticleList || [];
        const allArticles = [...freeArticles, ...chargeArticles];

        const episodesToSave = allArticles.map((article) => ({
          titleId: titleId,
          episodeNo: article.no,
          title: article.subtitle,
          thumbnailUrl: article.thumbnailUrl,
          uploadDate: article.serviceDateDescription,
          webtoon: parentWebtoon,
          url: `https://comic.naver.com/webtoon/detail?titleId=${article.titleId}&no=${article.no}`,
        }));

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
  // 🟢 2. 최초 1회용: 전체 웹툰 모든 회차 싹쓸이 (기존과 동일)
  // =========================================================================
  async seedAllNaverEpisodes(
    forceUpdate: boolean = false,
    startNumber: number = 1,
  ) {
    // ... (기존 코드 그대로 유지) ...
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

      await sleep(1000);
    }

    if (failedWebtoons.length > 0) {
      console.log(`🚨 에러 발생 ID 목록:`, failedWebtoons);
    } else {
      console.log(`✨ 완벽하게 모두 수집되었습니다.`);
    }

    return { message: '전체 수집 완료!' };
  }

  // =========================================================================
  // 🚀 3. 매일 새벽용: 최신 1페이지 업데이트 (기존과 동일)
  // =========================================================================
  async syncUpdatedEpisodes() {
    // ... (기존 코드 그대로 유지) ...
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
      const isSuccess = await this.seedSingleWebtoonEpisodes(numericTitleId, 1);
      if (isSuccess) successCount++;
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

  // =========================================================================
  // ⭐ 4. [NEW] 누락된 웹툰(19금 등) 전용 재수집 스위치! / 사실 별로 쓸일없을듯?
  // =========================================================================
  async seedMissingEpisodes() {
    console.log(
      `🔍 [탐색 시작] 회차가 0개인(수집 실패한) 네이버 웹툰을 찾습니다...`,
    );

    const naverWebtoons = await this.webtoonRepository.find({
      where: { id: Like('naver_%') },
    });

    const missingTitleIds: string[] = [];

    // 회차가 0개인 웹툰 골라내기
    for (const webtoon of naverWebtoons) {
      const numericTitleId = webtoon.id.replace('naver_', '');
      const count = await this.episodeRepository.count({
        where: { titleId: numericTitleId },
      });

      if (count === 0) {
        missingTitleIds.push(numericTitleId);
      }
    }

    console.log(
      `🚨 누락된 웹툰 총 ${missingTitleIds.length}개 발견! 재수집을 시작합니다.`,
    );

    if (missingTitleIds.length === 0) {
      return { message: '누락된 웹툰이 없습니다. 완벽합니다!' };
    }

    let successCount = 0;

    for (let i = 0; i < missingTitleIds.length; i++) {
      const titleId = missingTitleIds[i];
      console.log(
        `\n▶️ [누락본 수집 ${i + 1}/${missingTitleIds.length}] Title ID: ${titleId}`,
      );

      const isSuccess = await this.seedSingleWebtoonEpisodes(titleId);
      if (isSuccess) successCount++;

      await sleep(1000); // 안전을 위한 딜레이
    }

    console.log(
      `✨ 누락본 수집 완료! (성공: ${successCount}/${missingTitleIds.length})`,
    );
    return {
      message: '누락된 웹툰 회차 수집 완료!',
      totalMissing: missingTitleIds.length,
      successCount,
    };
  }

  // =========================================================================
  // ⭐ [NEW] 19금 성인 웹툰 전용 회차 재수집 스위치 (Upsert 덮어쓰기)
  // =========================================================================
  async seedAdultWebtoonEpisodes() {
    console.log(
      `🔞 [탐색 시작] 19금(isAdult: true) 네이버 웹툰을 모두 찾습니다...`,
    );

    // 🚀 DB에서 성인 웹툰만 쏙 골라오기!
    const adultWebtoons = await this.webtoonRepository.find({
      where: { platform: 'naver', isAdult: true },
    });

    console.log(
      `🚨 성인 웹툰 총 ${adultWebtoons.length}개 발견! 회차 덮어쓰기(Upsert)를 시작합니다.`,
    );

    if (adultWebtoons.length === 0) {
      return { message: '수집할 19금 웹툰이 없습니다.' };
    }

    let successCount = 0;

    for (let i = 0; i < adultWebtoons.length; i++) {
      const numericTitleId = adultWebtoons[i].id.replace('naver_', '');

      console.log(
        `\n▶️ [19금 덮어쓰기 ${i + 1}/${adultWebtoons.length}] Title ID: ${numericTitleId}`,
      );

      // 💡 Upsert 방식이라, 빈 회차는 새로 넣고 기존 회차는 덮어씁니다!
      const isSuccess = await this.seedSingleWebtoonEpisodes(numericTitleId);
      if (isSuccess) successCount++;

      await sleep(1000); // 네이버 차단 방지용 1초 휴식
    }

    console.log(
      `✨ 19금 웹툰 회차 복구/수집 완료! (성공: ${successCount}/${adultWebtoons.length})`,
    );
    return { message: '19금 회차 수집 완료', successCount };
  }
}
