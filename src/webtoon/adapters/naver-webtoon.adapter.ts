// src/webtoon/adapters/naver-webtoon.adapter.ts
import { Injectable } from '@nestjs/common';
import { CreateWebtoonDto } from '../dto/webtoon.dto';
import { WebtoonSourceAdapter } from './webtoon-source.adapter';

interface NaverContext {
  // 연재작은 오늘 수집한 연재 요일('MONDAY' 등)을, 완결작은 'FINISHED'를 넘긴다.
  publishDay: string;
}

@Injectable()
export class NaverWebtoonAdapter
  implements WebtoonSourceAdapter<any, NaverContext>
{
  readonly platform = 'naver';

  toWebtoonDto(raw: any, context: NaverContext): CreateWebtoonDto {
    return {
      id: `naver_${raw.titleId}`,
      titleId: String(raw.titleId),
      titleName: raw.titleName,
      searchTitle: raw.titleName.replace(/\s+/g, ''),
      author: raw.author,
      thumbnailUrl: raw.thumbnailUrl,
      isAdult: raw.adult === true,
      up: raw.up || false,
      rest: raw.rest || false,
      bm: raw.bm || false,
      starScore: raw.starScore || 0,
      publishDays: [context.publishDay],
      platform: this.platform,
    };
  }
}
