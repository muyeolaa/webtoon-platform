import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Webtoon } from './entities/webtoon.entity';

@Injectable()
export class KakaoCrawlerService {
  private readonly logger = new Logger(KakaoCrawlerService.name);

  constructor(
    private readonly httpService: HttpService,
    @InjectRepository(Webtoon)
    private readonly webtoonRepository: Repository<Webtoon>,
  ) {}

  async getKakaoWebtoons() {
    this.logger.log('🚀 카카오 웹툰 API 기반 크롤링을 시작합니다...');
    let totalSavedCount = 0;

    // 🗓️ 1. 카카오의 tab_uid(1~7)를 우리 서비스의 요일 규격으로 번역하는 사전
    const dayMap: { [key: number]: string } = {
      1: 'MONDAY',
      2: 'TUESDAY',
      3: 'WEDNESDAY',
      4: 'THURSDAY',
      5: 'FRIDAY',
      6: 'SATURDAY',
      7: 'SUNDAY',
    };

    try {
      // 🔄 2. 월요일(1)부터 일요일(7)까지 반복합니다.
      for (let day = 1; day <= 7; day++) {
        let page = 0; // 페이지는 0부터 시작
        let isEnd = false; // 끝에 도달했는지 확인하는 깃발

        this.logger.log(`⏳ [${dayMap[day]}] 요일 웹툰 수집 중...`);

        // ♾️ 3. 해당 요일의 데이터가 끝날 때(isEnd = true)까지 무한 스크롤(반복)
        while (!isEnd) {
          // API 주소에 요일(day)과 페이지(page) 변수를 주입합니다.
          const url = `https://bff-page.kakao.com/api/gateway/view/v2/landing/dayofweek?category_uid=10&subcategory_uid=0&screen_uid=52&bm=A&tab_uid=${day}&page=${page}`;

          const { data } = await firstValueFrom(
            this.httpService.get(url, {
              headers: {
                Referer: 'https://page.kakao.com/',
                'User-Agent':
                  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              },
            }),
          );

          // API 응답 데이터 (유저님이 찾아주신 바로 그 데이터 구조입니다!)
          const rawWebtoons = data?.result?.list;

          if (!rawWebtoons || rawWebtoons.length === 0) {
            // 데이터가 비어있으면 이 요일은 끝난 것으로 간주하고 빠져나갑니다.
            break;
          }

          // ✂️ 4. 데이터 정제 (WebtoonDto 규격으로 깎기)
          const finalWebtoons = rawWebtoons.map((item: any) => {
            // 카카오 이미지는 경로만 주어지므로, 앞에 도메인을 붙여서 완전한 주소로 조립합니다.
            const imagePath =
              item.asset_property?.banner_img ||
              item.asset_property?.card_img ||
              '';
            const fullThumbnailUrl = `https://dn-img-page.kakao.com/download/resource?kid=${imagePath}&filename=th3`;

            return {
              id: `kakao_${item.series_id}`, // "kakao_67740423"
              titleName: item.title,
              author: item.authors || '작자 미상', // 👈 이제 정확한 작가 이름이 들어갑니다!
              thumbnailUrl: fullThumbnailUrl,
              up: false,
              rest: false,
              bm: item.is_waitfree || item.business_model !== 'F', // 기다무거나 무료가 아니면 유료!
              publishDays: [dayMap[day]], // 👈 이제 'UNKNOWN'이 아니라 정확한 요일이 들어갑니다!
              starScore: 0,
              platform: 'kakao',
            };
          });

          // 📦 5. DB에 저장 (청크 처리 없이 25개 단위로 바로 덮어씁니다)
          await this.webtoonRepository.upsert(finalWebtoons, ['id']);
          totalSavedCount += finalWebtoons.length;

          // 🚩 6. 탈출 조건 확인 및 페이지 증가
          if (data.result.is_end === true) {
            isEnd = true; // 카카오 서버가 "마지막 페이지야!"라고 하면 무한 루프 종료
          } else {
            page++; // 아직 데이터가 더 있으면 다음 페이지 요청
          }

          // (선택) 서버에 너무 빠른 요청을 보내서 차단당하는 것을 막기 위한 0.5초 대기
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }

      this.logger.log(
        `✅ 모든 카카오 웹툰 총 ${totalSavedCount}개 수집 및 저장 완료!`,
      );
      return { message: '카카오 웹툰 수집 완료!', count: totalSavedCount };
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(
          `🚨 [크롤링 에러] 통신 및 처리 중 문제 발생: ${error.message}`,
        );
      } else {
        this.logger.error(
          `🚨 [알 수 없는 에러] 정체를 알 수 없는 에러 발생: ${String(error)}`,
        );
      }
      throw error;
    }
  }
}
