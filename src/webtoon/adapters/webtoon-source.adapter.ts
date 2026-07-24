// src/webtoon/adapters/webtoon-source.adapter.ts
import { CreateWebtoonDto } from '../dto/webtoon.dto';

// 플랫폼마다 다른 원본 API 응답을 우리 서비스 표준 규격(CreateWebtoonDto)으로 변환하는 공통 인터페이스.
// 새 플랫폼이 추가돼도 이 인터페이스를 구현하는 어댑터만 추가하면 되고,
// 크롤러/서비스 쪽 코드는 건드릴 필요가 없다 (OCP).
export interface WebtoonSourceAdapter<TRaw = any, TContext = any> {
  readonly platform: string;
  toWebtoonDto(raw: TRaw, context: TContext): CreateWebtoonDto;
}
