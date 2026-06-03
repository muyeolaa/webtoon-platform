export class WebtoonDto {
  id!: string; // 네이버 전용 고유 ID
  titleId!: string;
  titleName!: string; // 웹툰 제목
  author!: string; // 작가 (예: "작가1 / 작가2")
  thumbnailUrl?: string; // 썸네일 이미지
  up?: boolean; // 업데이트 여부
  rest?: boolean; // 휴재 여부
  bm?: boolean; // 기다무(기다리면 무료) 여부
  starScore?: number; // 네이버 평점
  publishDays?: string[]; //연제 요일
  newScore?: number; // 늑구 평점
  platform: string = 'naver';
}
