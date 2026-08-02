import { plainToInstance } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  validateSync,
} from 'class-validator';

export class WebtoonDto {
  @IsString()
  @IsNotEmpty()
  id!: string; // 네이버 전용 고유 ID

  @IsString()
  @IsNotEmpty()
  titleId!: string;

  @IsString()
  @IsNotEmpty()
  titleName!: string; // 웹툰 제목

  // titleName에서 공백을 제거해 저장 - 띄어쓰기 무시 검색용
  @IsOptional()
  @IsString()
  searchTitle?: string;

  @IsString()
  @IsNotEmpty()
  author!: string; // 작가 (예: "작가1 / 작가2")

  @IsOptional()
  @IsString()
  thumbnailUrl?: string; // 썸네일 이미지

  @IsOptional()
  @IsBoolean()
  up?: boolean; // 업데이트 여부

  @IsOptional()
  @IsBoolean()
  rest?: boolean; // 휴재 여부

  @IsOptional()
  @IsBoolean()
  bm?: boolean; // 기다무(기다리면 무료) 여부

  @IsOptional()
  @IsBoolean()
  isAdult?: boolean;

  @IsOptional()
  @IsNumber()
  starScore?: number; // 네이버 평점

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  publishDays?: string[]; //연제 요일

  @IsOptional()
  @IsNumber()
  newScore?: number; // 늑구 평점

  @IsOptional()
  @IsString()
  alias?: string; // 레진 등에서 사용하는 영문/문자열 고유 식별자

  @IsString()
  @IsNotEmpty()
  platform: string = 'naver';
}

// 크롤러 어댑터들이 이기종 플랫폼 원본 데이터를 매핑해 넣는 표준 규격 (WebtoonDto와 동일 shape)
export { WebtoonDto as CreateWebtoonDto };

// 비공식 API 응답을 매핑한 직후 이 함수로 검증한다 - 예측 불가능한 원본 응답이
// 필수 필드 누락/타입 불일치로 오염된 채 DB까지 흘러가는 것을 여기서 차단한다.
export function toValidatedWebtoonDto(
  plain: Record<string, unknown>,
): WebtoonDto {
  const dto = plainToInstance(WebtoonDto, plain);
  const errors = validateSync(dto, { whitelist: true });

  if (errors.length > 0) {
    const message = errors
      .map((error) => Object.values(error.constraints || {}).join(', '))
      .join('; ');
    throw new Error(
      `웹툰 데이터 검증 실패 (id=${String(plain.id)}): ${message}`,
    );
  }

  return dto;
}
