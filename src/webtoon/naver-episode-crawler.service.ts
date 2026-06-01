import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { Episode } from './entities/episode.entity'; // 경로가 맞는지 확인해줘!
import { Webtoon } from './entities/webtoon.entity';

// 1초 휴식용 수면제 함수
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

@Injectable()
export class NaverEpisodeCrawlerService {
  constructor(
    @InjectRepository(Episode)
    private readonly episodeRepository: Repository<Episode>,

    // 🚀 웹툰 테이블에서 ID를 꺼내오기 위해 주입!
    @InjectRepository(Webtoon)
    private readonly webtoonRepository: Repository<Webtoon>,
  ) {}

  // 네이버 웹툰 1개의 모든 회차를 긁어오는 함수
  async seedSingleWebtoonEpisodes(titleId: string) {
    let currentPage = 1;
    let totalPages = 1;

    console.log(`🚀 [네이버] ${titleId} 웹툰 회차 수집 시작...`);

    do {
      try {
        const url = `https://comic.naver.com/api/article/list?titleId=${titleId}&page=${currentPage}`;
        const response = await fetch(url);
        const data = await response.json();

        totalPages = data.pageInfo?.totalPages || 1;

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
        }));

        // DB에 저장
        await this.episodeRepository.save(episodesToSave);
        console.log(
          `✅ [네이버 ${titleId}] ${currentPage}/${totalPages} 페이지 저장 완료!`,
        );

        // 다음 페이지로 넘어가기 전 1초 휴식
        currentPage++;
        if (currentPage <= totalPages) {
          await sleep(1000);
        }
      } catch (error) {
        console.error(
          `❌ [네이버 ${titleId}] ${currentPage}페이지 수집 에러:`,
          (error as Error).message,
        );
        break; // 에러 발생 시 탈출
      }
    } while (currentPage <= totalPages);

    console.log(`🎉 [네이버] ${titleId} 웹툰 회차 수집 완료!`);
    return true; // 🚀 수정 3: 무사히 끝나면 "나 성공했어(true)" 라고 알려주기
  }

  // 전체 웹툰 회차 긁어 모으기
  async seedAllNaverEpisodes() {
    const naverWebtoons = await this.webtoonRepository.find({
      where: { id: Like('naver_%') },
    });
    console.log(
      `🔥 총 ${naverWebtoons.length}개의 네이버 웹툰 전체 수집을 시작합니다!`,
    );

    // 🚀 실패한 웹툰을 담을 블랙리스트 장부
    const failedWebtoons: string[] = [];

    for (let i = 0; i < naverWebtoons.length; i++) {
      const webtoon = naverWebtoons[i];

      // 🚀 에러가 났던 부분! 여기서 numericTitleId를 확실하게 선언해 줍니다.
      const rawId = webtoon.id;
      const numericTitleId = rawId.replace('naver_', '');

      // 1. 이미 수집된 웹툰인지 확인 (이어달리기 방어)
      const existingEpisodeCount = await this.episodeRepository.count({
        where: { titleId: numericTitleId },
      });

      if (existingEpisodeCount > 0) {
        console.log(
          `⏩ [${i + 1}/${naverWebtoons.length}] 웹툰(API ID: ${numericTitleId})은 이미 수집되어 건너뜁니다!`,
        );
        continue;
      }

      console.log(
        `\n▶️ [${i + 1}/${naverWebtoons.length}] 웹툰(API ID: ${numericTitleId}) 수집 시작...`,
      );

      // 2. 단일 수집기 호출 및 성공 여부(true/false) 받기
      const isSuccess = await this.seedSingleWebtoonEpisodes(numericTitleId);

      // 3. 실패했다면 블랙리스트에 기록
      if (!isSuccess) {
        failedWebtoons.push(numericTitleId);
      }

      console.log(`⏳ 다음 웹툰으로 넘어가기 전 3초 휴식...`);
      await sleep(3000);
    }

    console.log(`🎉 모든 네이버 웹툰 회차 수집이 완벽하게 끝났습니다!`);

    // 4. 마지막 결과 보고
    if (failedWebtoons.length > 0) {
      console.log(
        `🚨 수집에 실패한 웹툰 ID 목록 (${failedWebtoons.length}개):`,
        failedWebtoons,
      );
    } else {
      console.log(`✨ 완벽합니다! 단 하나의 에러도 없이 모두 수집되었습니다.`);
    }

    return { message: '전체 수집 완료!' };
  }
}
