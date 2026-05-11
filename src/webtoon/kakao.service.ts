import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';



@Injectable()
export class KakaoCrawlerService {
  private readonly logger = new Logger(KakaoCrawlerService.name);

  constructor(private readonly httpService: HttpService) {}

  async getKakaoWebtoons() {
          const url = 'https://page.kakao.com/menu/10010/screen/52?tab_uid=1';

          const { data } = await firstValueFrom(this.httpService.get(url,{
            headers: {
              'Referer': 'https://webtoon.kakao.com/',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                 },
             }),
          )

          const startTag = '<script id="__NEXT_DATA__" type="application/json">';
          const endTag = '</script>';
          const startIndex = data.indexOf(startTag) + startTag.length;
          const endIndex = data.indexOf(endTag, startIndex);
          const jsonRaw = data.substring(startIndex, endIndex);

          // [3. 파싱] - 문자열을 자바스크립트 객체로 변환
          const jsonData = JSON.parse(jsonRaw);
          console.log(jsonData.props.pageProps.initialProps.dehydratedState.queries[0].state.data.sections[0].groups[0].items)

          // const queries = jsonData.props.pageProps.initialProps.dehydratedState.queries[0].state.data.sections[0].groups[0].items;
          // [4. 정제] - 미로 같은 경로를 지나 진짜 웹툰 데이터만 뽑기
          // 카카오페이지의 실제 데이터 경로: props -> pageProps -> dehydratedState -> queries

          const result = [];        
        }
      }
      