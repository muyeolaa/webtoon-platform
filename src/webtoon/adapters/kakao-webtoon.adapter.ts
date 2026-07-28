// src/webtoon/adapters/kakao-webtoon.adapter.ts
import { Injectable } from '@nestjs/common';
import { CreateWebtoonDto } from '../dto/webtoon.dto';
import { WebtoonSourceAdapter } from './webtoon-source.adapter';

interface KakaoContext {
  tabId: number; // 12번 탭(완결)이면 무조건 FINISHED 처리
}

@Injectable()
export class KakaoWebtoonAdapter
  implements WebtoonSourceAdapter<any, KakaoContext>
{
  readonly platform = 'kakao';

  // 카카오만 요일을 '월,화' 같은 한글로 내려줘서 다른 플랫폼과 포맷을 맞추려면 이 매핑이 필요함
  private static readonly DAY_MAP: Record<string, string> = {
    월: 'MONDAY',
    화: 'TUESDAY',
    수: 'WEDNESDAY',
    목: 'THURSDAY',
    금: 'FRIDAY',
    토: 'SATURDAY',
    일: 'SUNDAY',
  };

  private parsePublishDays(pubPeriod: string): string[] {
    if (!pubPeriod) return ['UNKNOWN'];
    if (pubPeriod === '완결') return ['FINISHED'];

    return pubPeriod
      .split(',')
      .map((d) => KakaoWebtoonAdapter.DAY_MAP[d.trim()])
      .filter(Boolean);
  }

  toWebtoonDto(raw: any, context: KakaoContext): CreateWebtoonDto {
    // 썸네일 필드 경로가 작품마다 제각각이라 우선순위대로 폴백
    const imagePath =
      raw.asset_property?.banner_img ||
      raw.asset_property?.banner_set?.main_img ||
      raw.asset_property?.card_set?.background_img ||
      raw.asset_property?.card_img ||
      raw.asset_property?.banner_set?.background_img ||
      '';

    const thumbnailUrl = imagePath
      ? `https://dn-img-page.kakao.com/download/resource?kid=${imagePath}&filename=th3`
      : '';

    return {
      id: `kakao_${raw.series_id}`,
      titleId: raw.series_id.toString(),
      titleName: raw.title,
      // raw.titleName은 존재하지 않는 필드라 항상 undefined였음 - raw.title로 수정
      searchTitle: raw.title.replace(/\s+/g, ''),
      author: raw.authors || '작자 미상',
      thumbnailUrl,
      up: false,
      rest: raw.state === 'ST62',
      bm: raw.is_waitfree || raw.business_model !== 'F',
      // 완결 탭(tabId 12)은 pub_period가 비어있거나 부정확할 수 있어 무조건 FINISHED로 고정
      publishDays:
        context.tabId === 12 ? ['FINISHED'] : this.parsePublishDays(raw.pub_period),
      isAdult: raw.age_grade === 19,
      starScore: 0,
      platform: this.platform,
    };
  }
}
