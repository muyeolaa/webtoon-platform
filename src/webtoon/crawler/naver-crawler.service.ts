import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { WebtoonDto } from '../dto/webtoon.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Webtoon } from '../entities/webtoon.entity';
import { Repository, IsNull } from 'typeorm';
import { WebtoonService } from '../webtoon.service';
import { NaverEpisodeCrawlerService } from './naver-episode-crawler.service';

@Injectable()
export class NaverCrawlerService {
  private readonly logger = new Logger(NaverCrawlerService.name);

  constructor(
    private readonly httpService: HttpService,
    @InjectRepository(Webtoon)
    private readonly webtoonRepository: Repository<Webtoon>,
    private readonly webtoonService: WebtoonService,
    private readonly naverEpisodeCrawler: NaverEpisodeCrawlerService,
  ) {}

  // =========================================================================
  // 🟢 업그레이드 로직: 네이버 연재 중 웹툰 (정규 요일 + 매일+ 통합 수집)
  // =========================================================================
  async getNaverWebtoons() {
    this.logger.log(
      '🚀 네이버 연재 웹툰 (정규 요일 + 매일+) 수집을 시작합니다...',
    );

    // 1. 두 구역의 API 주소 준비
    const weekdayUrl =
      'https://comic.naver.com/api/webtoon/titlelist/weekday?order=user';
    const dailyPlusUrl =
      'https://comic.naver.com/api/webtoon/titlelist/weekday?week=dailyPlus&order=user'; // 매일+ API 주소

    const headers = {
      Referer: 'https://comic.naver.com/webtoon',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    };

    try {
      // [1단계] 요일 연재와 매일+ 연재 API를 "동시에" 호출합니다. (속도 향상 및 안전망 구축)
      const [weekdayRes, dailyPlusRes] = await Promise.all([
        firstValueFrom(this.httpService.get(weekdayUrl, { headers })),
        firstValueFrom(this.httpService.get(dailyPlusUrl, { headers })).catch(
          (err) => {
            this.logger.warn(
              '⚠️ 매일+ 웹툰 목록을 가져오는데 실패했습니다. 빈 배열로 대체합니다.',
              err.message,
            );
            return { data: { titleList: [] } }; // 에러가 나도 전체가 멈추지 않도록 빈 배열 반환
          },
        ),
      ]);

      // [2단계] 재료 다듬기 (데이터 평탄화 및 하드코딩 주입)

      // 2-1. 정규 요일 연재 리스트 가공
      const weekdayList = Object.entries(weekdayRes.data.titleListMap).flatMap(
        ([day, list]) => {
          return (list as any[]).map((webtoon) => ({ ...webtoon, today: day }));
        },
      );

      // 2-2. 매일+ 연재 리스트 가공 (API에 없는 요일 정보를 'DAILY_PLUS'로 강제 주입!)
      const rawDailyPlus = dailyPlusRes.data.titleList || [];
      const dailyPlusList = rawDailyPlus.map((webtoon: any) => ({
        ...webtoon,
        today: 'DAILY_PLUS',
      }));

      // 2-3. 두 부대의 명단을 하나로 합침
      const combinedList = [...weekdayList, ...dailyPlusList];

      // [3단계] 중복 제거 및 DB 규격으로 깎기
      const uniqueWebtoonsMap = new Map<number, WebtoonDto>();

      combinedList.forEach((rawWebtoon) => {
        const id = rawWebtoon.titleId;

        // [상황 A] 이미 사물함에 있다면 요일만 추가 (예: 수요일, DAILY_PLUS 둘 다 연재하는 경우)
        if (uniqueWebtoonsMap.has(id)) {
          const existingWebtoon = uniqueWebtoonsMap.get(id)!;
          if (!existingWebtoon.publishDays!.includes(rawWebtoon.today)) {
            existingWebtoon.publishDays!.push(rawWebtoon.today);
          }
        }
        // [상황 B] 사물함에 없다면 새로 만들어서 넣기
        else {
          const newWebtoonDto: WebtoonDto = {
            id: `naver_${rawWebtoon.titleId}`,
            titleId: String(rawWebtoon.titleId),
            titleName: rawWebtoon.titleName,
            searchTitle: rawWebtoon.titleName.replace(/\s+/g, ''),
            author: rawWebtoon.author,
            thumbnailUrl: rawWebtoon.thumbnailUrl,
            isAdult: rawWebtoon.adult === true,
            up: rawWebtoon.up || false,
            rest: rawWebtoon.rest || false,
            bm: rawWebtoon.bm || false,
            starScore: rawWebtoon.starScore || 0,
            publishDays: [rawWebtoon.today],
            platform: 'naver',
          };

          uniqueWebtoonsMap.set(id, newWebtoonDto as WebtoonDto);
        }
      });

      const finalWebtoonList = Array.from(uniqueWebtoonsMap.values());

      // [4단계] 통합된 대규모 데이터를 한 번에 DB에 서빙(Upsert)
      this.logger.log(
        `📦 총 ${finalWebtoonList.length}개의 연재작(정규+매일+) 저장을 시작합니다...`,
      );

      const chunkSize = 100;
      for (let i = 0; i < finalWebtoonList.length; i += chunkSize) {
        const chunk = finalWebtoonList.slice(i, i + chunkSize);
        await this.webtoonRepository.upsert(chunk, ['id']);
      }

      this.logger.log(`✅ DB 저장(Upsert) 완벽하게 성공!`);

      return {
        message: '네이버 연재웹툰(정규+매일+) 데이터 DB 저장 완료!',
        count: finalWebtoonList.length,
      };
    } catch (error) {
      this.logger.error('❌ 연재 데이터 수집 또는 저장 실패!', error);
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

      const description = data.synopsis || '';
      const genres = data.curationTagList
        ? data.curationTagList.map((tag: any) => tag.tagName)
        : [];

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
  // 🚀 신규 로직 2: DB를 훑어서 빈칸(소개글 Null)인 웹툰만 찾아 연속 수집  // 신작이면 소개글이 없으니 신작추적기능//회차정보도 긁어오기
  // =========================================================================
  async syncMissingDetails() {
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

    const delay = (ms: number) =>
      new Promise((resolve) => setTimeout(resolve, ms));
    let successCount = 0;

    for (const webtoon of targetWebtoons) {
      if (!webtoon.titleId || webtoon.titleId === 'null') {
        this.logger.warn(
          `⚠️ [${webtoon.id}] titleId가 비정상입니다. 건너뜁니다.`,
        );
        continue;
      }

      // 1. 상세 정보 수집!
      const success = await this.crawlAndSaveDetails(
        webtoon.titleId,
        webtoon.id,
      );

      // 2. 상세 정보 수집에 성공했다면?
      if (success) {
        successCount++;

        // 🚀 [NEW] 여기서 바로 해당 웹툰의 회차 정보도 싹쓸이하도록 호출!
        this.logger.log(
          `🔗 [연계 작업] ${webtoon.titleId} 상세 정보 완료. 즉시 회차 정보를 수집합니다!`,
        );

        try {
          // 기존에 잘 만들어둔 단일 웹툰 회차 수집 함수 실행
          await this.naverEpisodeCrawler.seedSingleWebtoonEpisodes(
            webtoon.titleId,
          );
        } catch (error) {
          this.logger.error(
            `❌ [${webtoon.titleId}] 연계 회차 수집 중 에러 발생:`,
            error,
          );
        }
      }

      await delay(1000); // 1초 휴식 (과부하 방지)
    }

    this.logger.log(
      `🎉 빈칸 채우기 & 회차 동기화 완료! (성공: ${successCount} / 전체: ${targetWebtoons.length})`,
    );

    return {
      message: '상세 정보 및 회차 동기화 작업이 완료되었습니다.',
      targetCount: targetWebtoons.length,
      successCount,
    };
  }

  // =========================================================================
  // 🚀 신규 로직 3: 네이버 완결 웹툰 수집 (최초 전체 수집 & 매일 증분 수집 겸용)
  // =========================================================================
  async getFinishedNaverWebtoons(maxPage: number = 2) {
    this.logger.log(`📚 네이버 완결 웹툰 수집 시작 (최대 ${maxPage}페이지)...`);

    let page = 1;
    let hasNextPage = true;
    let totalSavedCount = 0;

    const delay = (ms: number) =>
      new Promise((resolve) => setTimeout(resolve, ms));

    while (hasNextPage && page <= maxPage) {
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

        const rawWebtoons = data.titleList;

        if (!rawWebtoons || rawWebtoons.length === 0) {
          this.logger.log(
            `더 이상 수집할 웹툰이 없습니다. (종료 페이지: ${page})`,
          );
          break;
        }

        const finalWebtoons = rawWebtoons.map((item: any) => {
          return {
            id: `naver_${item.titleId}`,
            titleId: String(item.titleId),
            titleName: item.titleName,
            author: item.author,
            thumbnailUrl: item.thumbnailUrl,
            isAdult: item.adult === true,
            up: item.up || false,
            rest: item.rest || false,
            bm: item.bm || false,
            starScore: item.starScore || 0,
            publishDays: ['FINISHED'],
            platform: 'naver',
          };
        });

        await this.webtoonRepository.upsert(finalWebtoons, ['id']);
        totalSavedCount += finalWebtoons.length;

        this.logger.log(
          `[완결 ${page}페이지] ${finalWebtoons.length}개 저장 완료.`,
        );

        if (data.pageInfo && page >= data.pageInfo.totalPages) {
          hasNextPage = false;
        } else {
          page++;
        }

        await delay(500);
      } catch (error) {
        this.logger.error(
          `❌ 완결 웹툰 ${page}페이지 수집 중 통신 에러 발생!`,
          error,
        );
        break;
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
