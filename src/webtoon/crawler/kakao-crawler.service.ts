import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Webtoon } from '../entities/webtoon.entity';
import { AppConfig } from '../entities/config.entity'; // 🚀 1. AppConfig 추가

@Injectable() // (중복된 데코레이터 정리 완료!)
export class KakaoCrawlerService {
  private readonly logger = new Logger(KakaoCrawlerService.name);

  constructor(
    private readonly httpService: HttpService,
    @InjectRepository(Webtoon)
    private readonly webtoonRepository: Repository<Webtoon>,
    @InjectRepository(AppConfig) // 🚀 2. DB 토큰 조회를 위한 레포지토리 주입
    private readonly configRepository: Repository<AppConfig>,
  ) {}

  async getKakaoWebtoons() {
    this.logger.log('🚀 카카오 웹툰 API(BFF) 기반 크롤링을 시작합니다...');
    let totalSavedCount = 0;

    const targetTabs = [1, 2, 3, 4, 5, 6, 7, 11, 12];

    const tabNameMap: { [key: number]: string } = {
      1: '월요일',
      2: '화요일',
      3: '수요일',
      4: '목요일',
      5: '금요일',
      6: '토요일',
      7: '일요일',
      11: '🌱신작',
      12: '📚완결',
    };

    const parsePublishDays = (pubPeriod: string) => {
      if (!pubPeriod) return ['UNKNOWN'];
      if (pubPeriod === '완결') return ['FINISHED'];

      const dayMap: Record<string, string> = {
        월: 'MONDAY',
        화: 'TUESDAY',
        수: 'WEDNESDAY',
        목: 'THURSDAY',
        금: 'FRIDAY',
        토: 'SATURDAY',
        일: 'SUNDAY',
      };

      return pubPeriod
        .split(',')
        .map((d) => dayMap[d.trim()])
        .filter(Boolean);
    };

    // 🚀 [NEW] 크롤링 시작 전 DB에서 카카오 쿠키를 한 번만 가져옵니다!
    const cookieConfig = await this.configRepository.findOne({
      where: { variablename: 'KAKAO_COOKIE' },
    });
    const kakaoCookie = cookieConfig?.value;

    if (kakaoCookie) {
      this.logger.log('🔑 [카카오] DB에서 인증 쿠키가 확인되었습니다.');
    } else {
      this.logger.warn(
        '⚠️ [카카오] DB에 인증 쿠키가 없습니다. 기본 모드로 수집합니다.',
      );
    }

    try {
      for (const tabId of targetTabs) {
        let page = 0;
        let isEnd = false;

        this.logger.log(`⏳ [${tabNameMap[tabId]}] 탭 데이터 수집 중...`);

        while (!isEnd) {
          const url = `https://bff-page.kakao.com/api/gateway/view/v2/landing/dayofweek?category_uid=10&subcategory_uid=0&screen_uid=52&bm=A&tab_uid=${tabId}&page=${page}`;

          const headers: any = {
            Referer: 'https://page.kakao.com/',
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          };

          // 🚀 DB에서 가져온 쿠키를 헤더에 장착!
          if (kakaoCookie) {
            headers['Cookie'] = kakaoCookie;
          }

          const { data } = await firstValueFrom(
            this.httpService.get(url, { headers }),
          );

          const rawWebtoons = data?.result?.list;

          if (!rawWebtoons || rawWebtoons.length === 0) {
            break;
          }

          const finalWebtoons = rawWebtoons.map((item: any) => {
            const imagePath =
              item.asset_property?.banner_img ||
              item.asset_property?.banner_set?.main_img ||
              item.asset_property?.card_set?.background_img ||
              item.asset_property?.card_img ||
              item.asset_property?.banner_set?.background_img ||
              '';

            const fullThumbnailUrl = imagePath
              ? `https://dn-img-page.kakao.com/download/resource?kid=${imagePath}&filename=th3`
              : '';

            return {
              id: `kakao_${item.series_id}`,
              titleId: item.series_id.toString(),
              titleName: item.title,
              author: item.authors || '작자 미상',
              thumbnailUrl: fullThumbnailUrl,
              up: false,
              rest: item.state === 'ST62',
              bm: item.is_waitfree || item.business_model !== 'F',
              publishDays:
                tabId === 12 ? ['FINISHED'] : parsePublishDays(item.pub_period),
              isAdult: item.age_grade === 19,
              starScore: 0,
              platform: 'kakao',
            };
          });

          await this.webtoonRepository.upsert(finalWebtoons, ['id']);
          totalSavedCount += finalWebtoons.length;

          if (data.result.is_end === true) {
            isEnd = true;
          } else {
            page++;
          }

          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }

      this.logger.log(
        `✅ 모든 카카오 웹툰 총 ${totalSavedCount}개 수집 및 저장 완료!`,
      );
      return { message: '카카오 웹툰 전체 수집 완료!', count: totalSavedCount };
    } catch (error) {
      this.logger.error(
        `🚨 [카카오 크롤링 에러]: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }
}
