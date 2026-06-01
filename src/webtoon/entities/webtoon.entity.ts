// src/webtoon/entities/webtoon.entity.ts
import {
  Entity,
  PrimaryColumn,
  Column,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Episode } from './episode.entity';

@Entity('webtoon_table') // DB에 만들어질 진짜 테이블 이름
export class Webtoon {
  @PrimaryColumn()
  id!: string;

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

  // 🚀 1. 조회수 (아무도 안 봤으니 기본값 0)
  @Column({ default: 0 })
  viewCount?: number;

  // 🚀 2. 별점 (아직 평가가 없으니 기본값 0, 소수점도 들어갈 수 있게 float 타입 사용)
  @Column({ type: 'float', default: 0 })
  starRating?: number;

  // 🚀 3. 업데이트 날짜
  // TypeORM의 꿀기능! @UpdateDateColumn을 쓰면 데이터가 수정될 때마다
  // 백엔드가 알아서 현재 시간으로 갱신해 줍니다.
  @UpdateDateColumn()
  updatedAt?: Date;

  @OneToMany(() => Episode, (episode) => episode.webtoon)
  episodes?: Episode[];
}
