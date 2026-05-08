import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { NaverWebtoonDto } from '../dto/naver-item.dto';

@Injectable()
export class NaverCrawlerService {
  private readonly logger = new Logger(NaverCrawlerService.name);

  constructor(private readonly httpService: HttpService) {}

  async getNaverWebtoons() {
    const url = 'https://comic.naver.com/api/webtoon/titlelist/weekday?order=user';
    
    try {
      // [1단계] 재료 가져오기 (API 통신)
      const { data } = await firstValueFrom(
        this.httpService.get(url, {
          headers: {
            'Referer': 'https://comic.naver.com/webtoon',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
        }),
      );

      // [2단계] 재료 다듬기 (1차 가공: 평탄화)
      const flatWebtoonList = Object.entries(data.titleListMap).flatMap(([day, list]) => {
         return (list as any[]).map(webtoon => {
           return { ...webtoon, today: day }; 
         });
      });            

      const uniqueWebtoonsMap = new Map<number, NaverWebtoonDto>();

      flatWebtoonList.forEach((rawWebtoon) => {
        const id = rawWebtoon.titleId;

        // [상황 A] 이미 사물함에 있다면 요일만 추가
        if (uniqueWebtoonsMap.has(id)) {
          const existingWebtoon = uniqueWebtoonsMap.get(id)!;
          existingWebtoon.publishDays!.push(rawWebtoon.today); 
        } 
        // [상황 B] 사물함에 없다면 새로 만들어서 넣기
        else {
          const newWebtoonDto: NaverWebtoonDto = {
            titleId: rawWebtoon.titleId,
            titleName: rawWebtoon.titleName,
            author: rawWebtoon.author,
            thumbnailUrl: rawWebtoon.thumbnailUrl,
            up: rawWebtoon.up,
            rest: rawWebtoon.rest,
            bm: rawWebtoon.bm,
            starScore: rawWebtoon.starScore,
            publishDays: [rawWebtoon.today], // 여기서 최초로 배열 형태로 감싸줍니다.
          };
          uniqueWebtoonsMap.set(id, newWebtoonDto);
        }
      });

      // 맵의 값들만 꺼내서 최종 배열로 만듭니다.
      const finalWebtoonList = Array.from(uniqueWebtoonsMap.values());

      // ==========================================
      // [4단계] 서빙하기 (결과 확인 및 Return)
      // ==========================================
      this.logger.log(`🚀 데이터 정제 성공! 총 ${finalWebtoonList.length}개 완료`,finalWebtoonList[0]);
      
      // 💡 핵심: 기존에는 쓸데없는 정보가 섞인 원본 'data'를 리턴했지만,
      // 이제는 우리가 예쁘게 포장한 'finalWebtoonList'를 리턴해야 합니다!
      return finalWebtoonList;

    } catch (error) {
      this.logger.error('❌ 데이터 수집 실패!', error);
      throw error;
    }
  }
}