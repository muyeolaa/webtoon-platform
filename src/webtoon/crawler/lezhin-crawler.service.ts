import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { Webtoon } from '../entities/webtoon.entity';
import { WebtoonService } from '../webtoon.service';
import { AppConfig } from '../entities/config.entity'; // 🚀 1. AppConfig 엔티티 추가

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

            return {
              id: `lezhin_${item.id}`,
              titleId: String(item.id),
              alias: item.alias,
              titleName: item.title,
              author: authorStr,
              platform: 'lezhin',
              thumbnailUrl: fullThumbnailUrl,
              publishDays: days,
              isAdult: item.isAdult || false,
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
