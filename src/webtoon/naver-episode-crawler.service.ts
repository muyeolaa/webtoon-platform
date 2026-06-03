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

    const parentWebtoon = await this.webtoonRepository.findOne({
      where: { id: `naver_${titleId}` },
    });

    if (!parentWebtoon) {
      console.error(
        `❌ DB에서 부모 웹툰(naver_${titleId})을 찾을 수 없어 에피소드를 저장할 수 없습니다.`,
      );
      return false;
    }

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
          webtoon: parentWebtoon,
        }));

        // 🚀 수정 1: save() 대신 upsert()를 사용해 중복 에러를 방지하고 덮어쓰기(Update) 실행!
        // 기준점: 'titleId'와 'episodeNo'가 같으면 기존 데이터를 덮어씁니다.
        await this.episodeRepository.upsert(episodesToSave, [
          'titleId',
          'episodeNo',
        ]);

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
    return true; // 무사히 끝나면 "나 성공했어(true)" 라고 알려주기
  }

  // 전체 웹툰 회차 긁어 모으기
  // 🚀 수정 2: forceUpdate 스위치 추가 (기본값 false)
  // 🚀 수정 1: startNumber 파라미터 추가 (기본값은 1번부터)
  async seedAllNaverEpisodes(
    forceUpdate: boolean = false,
    startNumber: number = 1,
  ) {
    const naverWebtoons = await this.webtoonRepository.find({
      where: { id: Like('naver_%') },
      order: { id: 'ASC' },
    });

    console.log(
      `🔥 총 ${naverWebtoons.length}개의 네이버 웹툰 전체 수집을 시작합니다! (강제 업데이트: ${forceUpdate}, 시작 번호: ${startNumber})`,
    );

    const failedWebtoons: string[] = [];

    // 🚀 수정 2: 배열은 0부터 시작하니까, 입력받은 번호에서 1을 빼줍니다. (170번 -> 인덱스 169)
    const startIndex = startNumber > 0 ? startNumber - 1 : 0;

    // 🚀 수정 3: i = 0 이 아니라 i = startIndex 부터 반복문을 시작합니다!
    for (let i = startIndex; i < naverWebtoons.length; i++) {
      const webtoon = naverWebtoons[i];

      const rawId = webtoon.id;
      const numericTitleId = rawId.replace('naver_', '');

      // 1. 이미 수집된 웹툰인지 확인
      const existingEpisodeCount = await this.episodeRepository.count({
        where: { titleId: numericTitleId },
      });

      // 🚀 수정 3: 스위치가 꺼져 있고(&&), 이미 데이터가 있다면 건너뜁니다!
      // (만약 forceUpdate가 true라면 이 조건문을 무시하고 다시 긁어옵니다)
      if (!forceUpdate && existingEpisodeCount > 0) {
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
