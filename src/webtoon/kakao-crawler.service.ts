import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Webtoon } from './entities/webtoon.entity';

@Injectable()
@Injectable()
export class KakaoCrawlerService {
  private readonly logger = new Logger(KakaoCrawlerService.name);

  constructor(
    private readonly httpService: HttpService,
    @InjectRepository(Webtoon)
    private readonly webtoonRepository: Repository<Webtoon>,
  ) {}

  async getKakaoWebtoons() {
    this.logger.log('🚀 카카오 웹툰 API(BFF) 기반 크롤링을 시작합니다...');
    let totalSavedCount = 0;

    // 🗓️ 1. 카카오 탭 ID (1~7: 요일, 11: 신작, 12: 완결)
    const targetTabs = [1, 2, 3, 4, 5, 6, 7, 11, 12];

    // 로그 출력용 이름 사전
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

    // 🔠 한국어 요일을 우리 DB용 영어로 바꾸는 번역기 ("월,목" -> ["MONDAY", "THURSDAY"])
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

    try {
      // 🔄 2. 지정한 탭(요일+신작+완결)을 순회합니다.
      for (const tabId of targetTabs) {
        let page = 0;
        let isEnd = false;

        this.logger.log(`⏳ [${tabNameMap[tabId]}] 탭 데이터 수집 중...`);

        while (!isEnd) {
          // 🚀 tab_uid 자리에 요일/신작/완결 번호를 넣어서 요청!
          const url = `https://bff-page.kakao.com/api/gateway/view/v2/landing/dayofweek?category_uid=10&subcategory_uid=0&screen_uid=52&bm=A&tab_uid=${tabId}&page=${page}`;

          const headers: any = {
            Referer: 'https://page.kakao.com/',
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          };

          // 🚀 2. .env에 카카오 쿠키가 있다면 헤더에 장착!
          const kakaoCookie = process.env.KAKAO_COOKIE;
          if (kakaoCookie) {
            headers['Cookie'] = kakaoCookie;
          }

          const { data } = await firstValueFrom(
            this.httpService.get(url, {
              headers: {
                Referer: 'https://page.kakao.com/',
                'User-Agent':
                  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              },
            }),
          );

          const rawWebtoons = data?.result?.list;

          if (!rawWebtoons || rawWebtoons.length === 0) {
            break; // 데이터가 없으면 다음 탭으로 이동
          }

          // ✂️ 3. 데이터 정제
          const finalWebtoons = rawWebtoons.map((item: any) => {
            const imagePath =
              item.asset_property?.banner_img ||
              item.asset_property?.card_img ||
              '';
            const fullThumbnailUrl = `https://dn-img-page.kakao.com/download/resource?kid=${imagePath}&filename=th3`;

            // DB에 넣을 데이터 조립
            return {
              id: `kakao_${item.series_id}`,
              titleId: item.series_id.toString(),
              titleName: item.title,
              author: item.authors || '작자 미상',
              thumbnailUrl: fullThumbnailUrl,
              up: false, // 카카오 메인 리스트에선 업데이트 여부가 없으므로 일단 false (상세에서 잡을 예정)
              rest: item.state === 'ST62', // ST62가 휴재인 경우가 많음 (확인 필요)
              bm: item.is_waitfree || item.business_model !== 'F',
              publishDays: parsePublishDays(item.pub_period), // 👈 신작 탭에서도 정확한 요일이 박힘!
              isAdult: item.age_grade === 19, // 🔞 나이 제한이 19면 성인웹툰으로 분류!
              starScore: 0,
              platform: 'kakao',
            };
          });

          // 📦 4. DB 저장
          await this.webtoonRepository.upsert(finalWebtoons, ['id']);
          totalSavedCount += finalWebtoons.length;

          // 🚩 5. 탈출 조건 확인
          if (data.result.is_end === true) {
            isEnd = true;
          } else {
            page++;
          }

          // IP 차단 방지 0.5초 대기
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }

      this.logger.log(
        `✅ 모든 카카오 웹툰 총 ${totalSavedCount}개 수집 및 저장 완료!`,
      );
      return {
        message: '카카오 웹툰 전체(요일+신작+완결) 수집 완료!',
        count: totalSavedCount,
      };
    } catch (error) {
      this.logger.error(
        `🚨 [카카오 크롤링 에러]: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }
}
