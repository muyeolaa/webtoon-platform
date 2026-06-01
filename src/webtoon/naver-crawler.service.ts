import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { WebtoonDto } from './dto/webtoon.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Webtoon } from './entities/webtoon.entity';
import { Repository } from 'typeorm';

@Injectable()
export class NaverCrawlerService {
  private readonly logger = new Logger(NaverCrawlerService.name);

  constructor(
    private readonly httpService: HttpService,
    // 👇 1. DB를 조종할 수 있는 마법의 지팡이(Repository)를 받습니다.
    @InjectRepository(Webtoon)
    private readonly webtoonRepository: Repository<Webtoon>,
  ) {}
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
            titleName: rawWebtoon.titleName,
            author: rawWebtoon.author,
            thumbnailUrl: rawWebtoon.thumbnailUrl,
            up: rawWebtoon.up,
            rest: rawWebtoon.rest,
            bm: rawWebtoon.bm,
            starScore: rawWebtoon.starScore,
            publishDays: [rawWebtoon.today], // 여기서 최초로 배열 형태로 감싸줍니다.
            platform: 'naver',
          };
          uniqueWebtoonsMap.set(id, newWebtoonDto);
        }
      });

      // 맵의 값들만 꺼내서 최종 배열로 만듭니다.
      const finalWebtoonList = Array.from(uniqueWebtoonsMap.values());

      // [4단계] 서빙하기 (결과 확인 및 Return)
      this.logger.log(
        `DB에 데이터 저장을 시작합니다... (${finalWebtoonList.length}개)`,
      );
      // upsert: 이미 있는 titleId면 업데이트, 없으면 새로 생성!
      // 💡 100개씩 쪼개서 넣기 (안전하고 우아한 방식)
      const chunkSize = 100; // 한 번에 처리할 묶음 크기

      for (let i = 0; i < finalWebtoonList.length; i += chunkSize) {
        // 0~100, 100~200, 200~300... 이렇게 100개씩 잘라냅니다.
        const chunk = finalWebtoonList.slice(i, i + chunkSize);

        // 잘라낸 100개를 DB에 넣고, 완료될 때까지 기다렸다가 다음 100개를 처리합니다.
        await this.webtoonRepository.upsert(chunk, ['id']);
      }

      this.logger.log(`✅ DB 저장(Upsert) 완벽하게 성공!`);

      // 브라우저에는 저장 완료 메시지를 보내줍니다.
      return {
        message: '네이버 웹툰 데이터 DB 저장 완료!',
        count: finalWebtoonList.length,
      };
    } catch (error) {
      this.logger.error('❌ 데이터 수집 또는 저장 실패!', error);
      throw error;
    }
  }
}
