// src/webtoon/entities/webtoon.entity.ts
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn, // 🚀 새로 추가! (생성일 자동 기록)
  UpdateDateColumn,
  OneToMany,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { Episode } from './episode.entity';
import { Genre } from './genre.entity';

@Entity('webtoon_table') // DB에 만들어질 진짜 테이블 이름
export class Webtoon {
  @PrimaryColumn()
  id!: string;

  @Column({ nullable: true }) // 이미 저장된 기존 데이터들이 에러 나지 않게 임시로 비워둘 수 있게(nullable) 해주는 센스!
  titleId!: string;

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

  // 💡 크롤링해온 원본 플랫폼(네이버/카카오)의 기존 별점
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  starScore!: number;

  // 요일 배열은 텍스트 배열 형태로 저장합니다.
  @Column('text', { array: true })
  publishDays!: string[];

  // 💡 플랫폼 구분표 (네이버인지 카카오인지)
  @Column({ default: 'naver' })
  platform!: string;

  @Column({ type: 'boolean', default: false })
  isAdult!: boolean;

  // 1. 우리 통합 결제 플랫폼 자체 조회수 (아무도 안 봤으니 기본값 0)
  @Column({ default: 0 })
  viewCount?: number;

  // 2. 우리 통합 결제 플랫폼 자체 유저들의 평균 별점 (소수점 포함)
  @Column({ type: 'float', default: 0 })
  starRating?: number;

  // 🚀 새로 추가: 우리 사이트에서 별점을 준 진짜 유저 수!
  @Column({ default: 0 })
  starRatingCount!: number;

  // ==========================================
  // ⏱️ 시간 관련 컬럼들 (정렬 & 관리용)
  // ==========================================

  // 3. 데이터 생성일 (DB 관리/복구용 생명줄)
  // 크롤러가 DB에 처음 데이터를 넣은 시간이 자동으로 쾅 찍힘!
  @CreateDateColumn()
  createdAt!: Date;

  //  4. 데이터 수정일 (단순 업데이트 추적용)
  // TypeORM의 꿀기능! 데이터가 변경될 때마다 알아서 현재 시간으로 갱신.
  @UpdateDateColumn()
  updatedAt?: Date;

  //  5. 진짜 '최신순' 정렬용 (최근 회차 업데이트일)
  // 크롤링할 때 웹툰의 최신 회차가 올라온 날짜를 파싱해서 직접 넣어줄 공간!
  // (과거 데이터는 비어있을 수 있으니 nullable: true)
  @Column({ type: 'timestamp', nullable: true })
  lastEpisodeUpdatedAt?: Date;

  // 🚀 6. 실시간인기순 정렬용 점수판 (매일 새벽 스케줄러가 계산해서 채워줌)
  @Column({ type: 'float', default: 0 })
  trendingScore!: number;

  // 🚀 7. 북마크순 정렬용 카운트 (스케줄러가 진짜 북마크 테이블 개수를 세어서 채워줌)
  @Column({ default: 0 })
  bookmarkCount!: number;

  // ==========================================

  @OneToMany(() => Episode, (episode) => episode.webtoon)
  episodes?: Episode[];

  @Column({ type: 'text', nullable: true })
  description!: string;

  @Column({
    nullable: true,
    comment: '레진 등에서 사용하는 영문/문자열 고유 식별자',
  })
  alias?: string;

  // 다대다(N:M) 관계의 하이라이트!
  @ManyToMany(() => Genre, (genre) => genre.webtoons, {
    cascade: true, // 💡 웹툰을 저장할 때, 새로운 장르가 있으면 알아서 DB에 같이 저장해주는 옵션!
  })
  @JoinTable({
    name: 'webtoon_genres',
    joinColumn: { name: 'webtoon_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'genre_id', referencedColumnName: 'id' },
  })
  genres?: Genre[];
}
