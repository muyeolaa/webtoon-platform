// src/webtoon/adapters/lezhin-webtoon.adapter.ts
import { Injectable } from '@nestjs/common';
import { CreateWebtoonDto } from '../dto/webtoon.dto';
import { WebtoonSourceAdapter } from './webtoon-source.adapter';

interface LezhinContext {
  isCompleted: boolean;
  // 외부 API가 뭐라 하든, DB에 이미 19금으로 저장돼 있었다면 무조건 true 유지 (오염 방어)
  isAlreadyAdultInDB: boolean;
}

@Injectable()
export class LezhinWebtoonAdapter
  implements WebtoonSourceAdapter<any, LezhinContext>
{
  readonly platform = 'lezhin';

  private static readonly DAY_MAP: Record<string, string> = {
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

  private convertDayToEnglish(day: string): string {
    return LezhinWebtoonAdapter.DAY_MAP[day?.toUpperCase()] || 'UNKNOWN';
  }

  toWebtoonDto(raw: any, context: LezhinContext): CreateWebtoonDto {
    const author = raw.artists
      ? raw.artists.map((a: any) => a.name).join(', ')
      : '작가미상';

    const publishDays = context.isCompleted
      ? ['FINISHED']
      : raw.schedule?.periods?.map((day: string) =>
          this.convertDayToEnglish(day),
        ) || [];

    const updatedAt = raw.updatedAt || new Date().getTime();
    const thumbnailUrl = `https://ccdn.lezhin.com/v2/comics/${raw.id}/images/wide.webp?updated=${updatedAt}`;

    // DB에 이미 19금으로 저장돼 있다면 무조건 true를, 아니면 외부 API 값을 그대로 신뢰
    const isAdult = context.isAlreadyAdultInDB ? true : raw.isAdult || false;

    return {
      id: `lezhin_${raw.id}`,
      titleId: String(raw.id),
      alias: raw.alias,
      titleName: raw.title,
      // raw.titleName도 존재하지 않는 필드라 항상 undefined였음 - raw.title로 수정
      searchTitle: raw.title.replace(/\s+/g, ''),
      author,
      thumbnailUrl,
      publishDays,
      isAdult,
      up: raw.badges ? String(raw.badges).toLowerCase().includes('up') : false,
      platform: this.platform,
    };
  }
}
