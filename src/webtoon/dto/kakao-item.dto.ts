export class KakaoWebtoonDto {
  titleName?: string;   // 웹툰 제목
  thumbnailUrl?: string; // 썸네일 이미지
  author?: string;      // 작가 (예: "작가1 / 작가2")
  titleId?: number;     // 네이버 전용 고유 ID
  up?: boolean;         // 업데이트 여부
  rest?: boolean;       // 휴재 여부
  bm?: boolean;         // 기다무(기다리면 무료) 여부
  starScore?: number;  // 네이버 평점
  newScore?: number;   // 늑구 평점


}