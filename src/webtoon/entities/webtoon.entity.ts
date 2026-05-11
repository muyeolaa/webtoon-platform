// src/webtoon/entities/webtoon.entity.ts
import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('webtoon_table') // DB에 만들어질 진짜 테이블 이름
export class Webtoon {
  @PrimaryColumn() // 고유 ID (네이버/카카오의 웹툰 고유번호)
  titleId!: number;

  @Column()
  titleName!: string;

  @Column()
  author!: string;

  @Column()
  thumbnailUrl!: string;

  @Column({ default: false })
  up!: boolean;

  @Column({ default: false })
  rest!: boolean;

  @Column({ default: false })
  bm!: boolean;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  starScore!: number;

  // 요일 배열은 텍스트 배열 형태로 저장합니다.
  @Column('text', { array: true })
  publishDays!: string[];

  // 💡 플랫폼 구분표 (네이버인지 카카오인지)
  @Column({ default: 'naver' })
  platform!: string;
}