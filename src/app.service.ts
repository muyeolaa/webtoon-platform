import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  constructor(private readonly httpService: HttpService) {}

  async getNaverWebtoons() {
    const url = 'https://comic.naver.com/api/webtoon/titlelist/weekday?order=user';
    
    try {
      const { data } = await firstValueFrom(
        this.httpService.get(url, {
          headers: {
            'Referer': 'https://comic.naver.com/webtoon',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
        }),
      );
      
      // 월요일 웹툰 중 첫 번째 데이터의 제목만 확인용으로 콘솔에 찍어봅니다.
      const firstWebtoon = data.titleListMap.MONDAY[0];
      this.logger.log(`🚀 데이터 수집 성공! 첫 번째 월요 웹툰: ${firstWebtoon.titleName}`);
      
      return data;
    } catch (error) {
      this.logger.error('❌ 데이터 수집 실패!');
      throw error;
    }
  }
}