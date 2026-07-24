// src/webtoon/adapters/webtoon-adapter.factory.ts
import { Injectable } from '@nestjs/common';
import { WebtoonSourceAdapter } from './webtoon-source.adapter';
import { NaverWebtoonAdapter } from './naver-webtoon.adapter';
import { KakaoWebtoonAdapter } from './kakao-webtoon.adapter';
import { LezhinWebtoonAdapter } from './lezhin-webtoon.adapter';

// 플랫폼 문자열만 알면 알맞은 어댑터를 골라주는 팩토리.
// 새 플랫폼을 연동할 때도 여기 한 줄만 추가하면 되고, 크롤러의 기존 로직은 그대로 둔다.
@Injectable()
export class WebtoonAdapterFactory {
  constructor(
    private readonly naverAdapter: NaverWebtoonAdapter,
    private readonly kakaoAdapter: KakaoWebtoonAdapter,
    private readonly lezhinAdapter: LezhinWebtoonAdapter,
  ) {}

  getAdapter(platform: 'naver' | 'kakao' | 'lezhin'): WebtoonSourceAdapter {
    switch (platform) {
      case 'naver':
        return this.naverAdapter;
      case 'kakao':
        return this.kakaoAdapter;
      case 'lezhin':
        return this.lezhinAdapter;
      default:
        throw new Error(`지원하지 않는 플랫폼입니다: ${platform}`);
    }
  }
}
