export class WebtoonDto {
  id!: string; // 네이버 전용 고유 ID
  titleId!: string;
  titleName!: string; // 웹툰 제목
  // titleName에서 공백을 제거해 저장 - 띄어쓰기 무시 검색용
  searchTitle?: string;
  author!: string; // 작가 (예: "작가1 / 작가2")
  thumbnailUrl?: string; // 썸네일 이미지
  up?: boolean; // 업데이트 여부
  rest?: boolean; // 휴재 여부
  bm?: boolean; // 기다무(기다리면 무료) 여부
  isAdult?: boolean;
  starScore?: number; // 네이버 평점
  publishDays?: string[]; //연제 요일
  newScore?: number; // 늑구 평점
  alias?: string; // 레진 등에서 사용하는 영문/문자열 고유 식별자
  platform: string = 'naver';
}

// 크롤러 어댑터들이 이기종 플랫폼 원본 데이터를 매핑해 넣는 표준 규격 (WebtoonDto와 동일 shape)
export { WebtoonDto as CreateWebtoonDto };
