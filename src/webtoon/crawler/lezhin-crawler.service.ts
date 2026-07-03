import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { Webtoon } from '../entities/webtoon.entity';
import { WebtoonService } from '../webtoon.service';
import { AppConfig } from '../entities/config.entity';

@Injectable()
export class LezhinCrawlerService {
  private readonly logger = new Logger(LezhinCrawlerService.name);

  constructor(
    @InjectRepository(Webtoon)
    private readonly webtoonRepository: Repository<Webtoon>,
    @InjectRepository(AppConfig) // 🚀 2. DB 토큰 조회를 위한 레포지토리 주입
    private readonly configRepository: Repository<AppConfig>,
    private readonly httpService: HttpService,
    private readonly webtoonService: WebtoonService,
  ) {}

  // =========================================================================
  // 🚀 레진코믹스 연재/완결 전체 웹툰 리스트 수집기 (19금 해제 모드)
  // =========================================================================
  async getLezhinWebtoons() {
    this.logger.log(
      '🔴 [레진코믹스] API 기반 전체 리스트 수집을 시작합니다...',
    );

    const filters = [
      'mon',
      'tue',
      'wed',
      'thu',
      'fri',
      'sat',
      'sun',
      'day_10',
      'completed',
    ];
    let totalSaved = 0;

    const headers: any = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      Referer: 'https://www.lezhin.com/ko/scheduled',
      'X-Lz-Locale': 'ko-KR',
      'x-lz-allowadult': 'true',
      'x-lz-adult': '2',
      'x-lz-country': 'kr',
    };

    // 🚀 [수정] 환경변수 대신 DB에서 실시간 레진 토큰을 조회합니다.
    const lezhinTokenConfig = await this.configRepository.findOne({
      where: { variablename: 'LEZHIN_TOKEN' },
    });

    if (lezhinTokenConfig?.value) {
      this.logger.log(
        '🔑 [레진코믹스] DB에서 성인 인증 토큰이 확인되었습니다. 19금 웹툰 수집을 활성화합니다.',
      );
      headers['Authorization'] = lezhinTokenConfig.value;
    } else {
      this.logger.warn(
        '⚠️ [레진코믹스] DB에 토큰이 없습니다. 19금 성인 웹툰은 수집되지 않습니다.',
      );
    }

    try {
      for (const filter of filters) {
        let offset = 0;
        const limit = 100;
        let hasNext = true;

        this.logger.log(`▶️ [레진코믹스] '${filter}' 카테고리 수집 중...`);

        while (hasNext) {
          const url = `https://www.lezhin.com/lz-api/v2/content-list/weekday?filter=${filter}&offset=${offset}&limit=${limit}`;

          const { data } = await firstValueFrom(
            this.httpService.get(url, { headers }),
          );

          const webtoonList = data?.data || [];

          if (webtoonList.length === 0) {
            hasNext = false;
            break;
          }

          // =====================================================================
          // 🚀 [추가된 방어 로직] 기존 DB의 19금 상태 확인하기
          // =====================================================================
          // 1. 이번 페이지에서 수집한 웹툰들의 ID만 쏙 뽑아냅니다.
          const currentLezhinIds = webtoonList.map(
            (item: any) => `lezhin_${item.id}`,
          );

          // 2. DB에서 해당 ID들을 가진 웹툰들의 '현재 19금 상태'만 가볍게 조회합니다.
          const existingWebtoons = await this.webtoonRepository.find({
            where: { id: In(currentLezhinIds) },
            select: ['id', 'isAdult'], // 성능을 위해 id와 isAdult 컬럼만 가져옴
          });

          // 3. 빠르게 찾을 수 있도록 Map 형태로 만들어 줍니다. (예: { 'lezhin_123' => true })
          const existingAdultMap = new Map(
            existingWebtoons.map((w) => [w.id, w.isAdult]),
          );
          // =====================================================================

          const webtoonsToSave = webtoonList.map((item: any) => {
            const authorStr = item.artists
              ? item.artists.map((a: any) => a.name).join(', ')
              : '작가미상';

            const isCompleted =
              item.contentsState === 'completed' || filter === 'completed';

            const days = isCompleted
              ? ['FINISHED']
              : item.schedule?.periods?.map((day: string) =>
                  this.convertDayToEnglish(day),
                ) || [];

            const lezhinUpdatedAt = item.updatedAt || new Date().getTime();
            const fullThumbnailUrl = `https://ccdn.lezhin.com/v2/comics/${item.id}/images/wide.webp?updated=${lezhinUpdatedAt}`;

            const webtoonId = `lezhin_${item.id}`;

            // 🚀 [핵심] DB에 이미 true(19금)로 저장되어 있다면 무조건 true를 유지!
            // 그게 아니라면(신작이거나 원래 false였다면) API에서 가져온 기본값을 씁니다.
            const isAlreadyAdultInDB = existingAdultMap.get(webtoonId) === true;
            const finalIsAdult = isAlreadyAdultInDB
              ? true
              : item.isAdult || false;

            return {
              id: webtoonId,
              titleId: String(item.id),
              alias: item.alias,
              titleName: item.title,
              searchTitle: item.titleName.replace(/\s+/g, ''),
              author: authorStr,
              platform: 'lezhin',
              thumbnailUrl: fullThumbnailUrl,
              publishDays: days,

              isAdult: finalIsAdult, // 👈 방어막이 쳐진 최종 19금 판별값 적용!

              up: item.badges
                ? String(item.badges).toLowerCase().includes('up')
                : false,
            };
          });

          await this.webtoonRepository.upsert(webtoonsToSave, {
            conflictPaths: ['id'],
          });

          totalSaved += webtoonsToSave.length;

          if (webtoonList.length < limit) {
            hasNext = false;
          } else {
            offset += limit;
            await new Promise((res) => setTimeout(res, 500));
          }
        }
      }

      this.logger.log(
        `🎉 [레진코믹스] 총 ${totalSaved}개의 웹툰 리스트 수집 및 갱신 완료!`,
      );
      return true;
    } catch (error: any) {
      if (error.response?.status === 401) {
        this.logger.error(
          '🚨 [레진코믹스] 인증 토큰이 만료되었거나 유효하지 않습니다! DB의 LEZHIN_TOKEN을 새로 교체해 주세요.',
        );
      } else {
        this.logger.error(
          `❌ [레진코믹스] 리스트 수집 중 통신 에러: ${error.message}`,
        );
      }
      return false;
    }
  }

  private convertDayToEnglish(day: string): string {
    const daysMap: Record<string, string> = {
      MON: 'MONDAY',
      TUE: 'TUESDAY',
      WED: 'WEDNESDAY',
      THU: 'THURSDAY',
      FRI: 'FRIDAY',
      SAT: 'SATURDAY',
      SUN: 'SUNDAY',
      DAY_10: 'TEN_DAYS',
      '10N': 'TEN_DAYS',
      '10D': 'TEN_DAYS',
      '10': 'TEN_DAYS',
    };
    return daysMap[day?.toUpperCase()] || 'UNKNOWN';
  }
}
