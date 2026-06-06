import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { WebtoonDto } from './dto/webtoon.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Webtoon } from './entities/webtoon.entity';
import { Repository, IsNull } from 'typeorm'; // 🚀 1. IsNull 추가!
import { WebtoonService } from './webtoon.service'; // 🚀 2. 데이터를 담을 바구니(Service) 추가!

@Injectable()
export class NaverCrawlerService {
  private readonly logger = new Logger(NaverCrawlerService.name);

  constructor(
    private readonly httpService: HttpService,
    // 👇 1. DB를 조종할 수 있는 마법의 지팡이(Repository)를 받습니다.
    @InjectRepository(Webtoon)
    private readonly webtoonRepository: Repository<Webtoon>,

    // 🚀 3. 아까 만든 WebtoonService(바구니)를 주입받습니다!
    private readonly webtoonService: WebtoonService,
  ) {}

  // =========================================================================
  // 🟢 기존 로직: 네이버 웹툰 전체 목록 가져오기 (수정 없음!)
  // =========================================================================
  async getNaverWebtoons() {
    const url =
      'https://comic.naver.com/api/webtoon/titlelist/weekday?order=user';

    try {
      // [1단계] 재료 가져오기 (API 통신)
      const { data } = await firstValueFrom(
        this.httpService.get(url, {
          headers: {
            Referer: 'https://comic.naver.com/webtoon',
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
        }),
      );

      // [2단계] 재료 다듬기 (1차 가공: 평탄화)
      const flatWebtoonList = Object.entries(data.titleListMap).flatMap(
        ([day, list]) => {
          return (list as any[]).map((webtoon) => {
            return { ...webtoon, today: day };
          });
        },
      );

      const uniqueWebtoonsMap = new Map<number, WebtoonDto>();

      flatWebtoonList.forEach((rawWebtoon) => {
        const id = rawWebtoon.titleId;

        // [상황 A] 이미 사물함에 있다면 요일만 추가
        if (uniqueWebtoonsMap.has(id)) {
          const existingWebtoon = uniqueWebtoonsMap.get(id)!;
          existingWebtoon.publishDays!.push(rawWebtoon.today);
        }
        // [상황 B] 사물함에 없다면 새로 만들어서 넣기
        else {
          const newWebtoonDto: WebtoonDto = {
            id: `naver_${rawWebtoon.titleId}`,
            titleId: rawWebtoon.titleId,
            titleName: rawWebtoon.titleName,
            author: rawWebtoon.author,
            thumbnailUrl: rawWebtoon.thumbnailUrl,
            up: rawWebtoon.up,
            rest: rawWebtoon.rest,
            bm: rawWebtoon.bm,
            starScore: rawWebtoon.starScore,
            publishDays: [rawWebtoon.today],
            platform: 'naver',
          };

          uniqueWebtoonsMap.set(id, newWebtoonDto as WebtoonDto);
        }
      });

      // 맵의 값들만 꺼내서 최종 배열로 만듭니다.
      const finalWebtoonList = Array.from(uniqueWebtoonsMap.values());

      // [4단계] 서빙하기 (결과 확인 및 Return)
      this.logger.log(
        `DB에 데이터 저장을 시작합니다... (${finalWebtoonList.length}개)`,
      );

      const chunkSize = 100;

      for (let i = 0; i < finalWebtoonList.length; i += chunkSize) {
        const chunk = finalWebtoonList.slice(i, i + chunkSize);
        await this.webtoonRepository.upsert(chunk, ['id']);
      }

      this.logger.log(`✅ DB 저장(Upsert) 완벽하게 성공!`);

      return {
        message: '네이버 웹툰 데이터 DB 저장 완료!',
        count: finalWebtoonList.length,
      };
    } catch (error) {
      this.logger.error('❌ 데이터 수집 또는 저장 실패!', error);
      throw error;
    }
  }

  // =========================================================================
  // 🚀 신규 로직 1: 단일 웹툰 상세 정보(소개글, 장르) 수집 (JSON API 사용)
  // =========================================================================
  async crawlAndSaveDetails(titleId: string, webtoonId: string) {
    const url = `https://comic.naver.com/api/article/list/info?titleId=${titleId}`;

    try {
      const { data } = await firstValueFrom(
        this.httpService.get(url, {
          headers: {
            Referer: 'https://comic.naver.com/webtoon',
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
        }),
      );

      // JSON 데이터에서 소개글과 장르 배열 추출
      const description = data.synopsis || '';
      const genres = data.curationTagList
        ? data.curationTagList.map((tag: any) => tag.tagName)
        : [];

      // WebtoonService의 바구니 함수를 호출하여 DB에 안전하게 저장!
      await this.webtoonService.updateWebtoonDetails(
        webtoonId,
        description,
        genres,
      );

      this.logger.log(
        `[${titleId}] 상세정보 수집 완료 (장르 ${genres.length}개)`,
      );
      return true;
    } catch (error) {
      this.logger.error(`❌ [${titleId}] 상세 정보 수집 실패!`, error);
      return false;
    }
  }

  // =========================================================================
  // 🚀 신규 로직 2: DB를 훑어서 빈칸(소개글 Null)인 웹툰만 찾아 연속 수집
  // =========================================================================
  async syncMissingDetails() {
    // 1. 네이버 웹툰 중 소개글이 빈칸인 데이터만 조회
    const targetWebtoons = await this.webtoonRepository.find({
      where: {
        platform: 'naver',
        description: IsNull(),
      },
    });

    this.logger.log(
      `👀 총 ${targetWebtoons.length}개의 웹툰 상세 정보를 수집해야 합니다.`,
    );

    if (targetWebtoons.length === 0) {
      return { message: '모든 웹툰의 상세 정보가 이미 꽉 차 있습니다!' };
    }

    // 1초 딜레이 타이머 함수
    const delay = (ms: number) =>
      new Promise((resolve) => setTimeout(resolve, ms));
    let successCount = 0;

    // 2. 찾아낸 빈칸 웹툰들을 하나씩 돌면서 수집 시작
    for (const webtoon of targetWebtoons) {
      const success = await this.crawlAndSaveDetails(
        webtoon.titleId,
        webtoon.id,
      );

      if (success) {
        successCount++;
      }

      // 3. 네이버 IP 차단 방지를 위해 무조건 1초 대기!
      await delay(1000);
    }

    this.logger.log(
      `🎉 빈칸 채우기 완료! (성공: ${successCount} / 전체: ${targetWebtoons.length})`,
    );

    return {
      message: '상세 정보 빈칸 채우기 작업이 완료되었습니다.',
      targetCount: targetWebtoons.length,
      successCount,
    };
  }

  // =========================================================================
  // 🚀 신규 로직 3: 네이버 완결 웹툰 수집 (최초 전체 수집 & 매일 증분 수집 겸용)
  // =========================================================================
  /**
   * @param maxPage 수집할 최대 페이지 수 (기본값 2) -> 스케줄러에서는 2페이지만!
   */
  async getFinishedNaverWebtoons(maxPage: number = 2) {
    this.logger.log(`📚 네이버 완결 웹툰 수집 시작 (최대 ${maxPage}페이지)...`);

    let page = 1;
    let hasNextPage = true;
    let totalSavedCount = 0;

    // 마법의 타이머 (IP 차단 방지)
    const delay = (ms: number) =>
      new Promise((resolve) => setTimeout(resolve, ms));

    while (hasNextPage && page <= maxPage) {
      // 💡 order=UPDATE 정렬 덕분에 방금 완결/유료화된 웹툰이 무조건 1페이지에 나옵니다!
      const url = `https://comic.naver.com/api/webtoon/titlelist/finished?page=${page}&order=UPDATE`;

      try {
        const { data } = await firstValueFrom(
          this.httpService.get(url, {
            headers: {
              Referer: 'https://comic.naver.com/webtoon',
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            },
          }),
        );

        // API 응답 구조에서 웹툰 배열을 꺼냅니다. (보통 titleList에 들어있습니다)
        const rawWebtoons = data.titleList;

        // 더 이상 데이터가 없으면 무한 루프 탈출!
        if (!rawWebtoons || rawWebtoons.length === 0) {
          this.logger.log(
            `더 이상 수집할 웹툰이 없습니다. (종료 페이지: ${page})`,
          );
          break;
        }

        // ✂️ 데이터 정제 (우리 DB 규격에 맞게 깎기)
        const finalWebtoons = rawWebtoons.map((item: any) => {
          return {
            id: `naver_${item.titleId}`,
            titleId: String(item.titleId), // 혹시 모를 에러 방지를 위해 문자열로 확실히 감싸기
            titleName: item.titleName,
            author: item.author,
            thumbnailUrl: item.thumbnailUrl,
            up: item.up || false,
            rest: item.rest || false,
            bm: item.bm || false, // 💰 유료(쿠키) 전환 여부 파악!
            starScore: item.starScore || 0,
            publishDays: ['FINISHED'], // 🚀 연재 요일 대신 'FINISHED' 태그를 달아줍니다!
            platform: 'naver',
          };
        });

        // 📦 DB에 저장 (Upsert: 기존 데이터면 덮어쓰고, 없으면 새로 만듦)
        await this.webtoonRepository.upsert(finalWebtoons, ['id']);
        totalSavedCount += finalWebtoons.length;

        this.logger.log(
          `[완결 ${page}페이지] ${finalWebtoons.length}개 저장 완료.`,
        );

        // 네이버 API가 알려주는 전체 페이지 수(totalPages)를 확인하여 종료 조건 설정
        if (data.pageInfo && page >= data.pageInfo.totalPages) {
          hasNextPage = false;
        } else {
          page++;
        }

        // 안전한 수집을 위해 1페이지 긁을 때마다 0.5초 휴식
        await delay(500);
      } catch (error) {
        this.logger.error(
          `❌ 완결 웹툰 ${page}페이지 수집 중 통신 에러 발생!`,
          error,
        );
        break; // 에러가 나면 멈추고 지금까지 모은 것만 살립니다.
      }
    }

    this.logger.log(`✅ 네이버 완결 웹툰 총 ${totalSavedCount}개 수집 성공!`);
    return {
      message: '네이버 완결 웹툰 수집 완료',
      scrapedPages: page - 1,
      count: totalSavedCount,
    };
  }
}
