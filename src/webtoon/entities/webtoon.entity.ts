// src/webtoon/entities/webtoon.entity.ts
import {
  Entity,
  PrimaryColumn,
  Column,
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

  @Column({ type: 'text', nullable: true })
  description!: string;

  // 🚀 2. 다대다(N:M) 관계의 하이라이트!
  @ManyToMany(() => Genre, (genre) => genre.webtoons, {
    cascade: true, // 💡 꿀팁: 웹툰을 저장할 때, 새로운 장르가 있으면 알아서 DB에 같이 저장(INSERT)해주는 마법의 옵션!
  })
  // 다대다 관계에서는 '중간 연결 테이블'이 필요한데, @JoinTable()을 달아주면 TypeORM이 알아서 만들어줍니다.
  @JoinTable({
    name: 'webtoon_genres', // 알아서 만들어질 중간 테이블 이름
    joinColumn: { name: 'webtoon_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'genre_id', referencedColumnName: 'id' },
  })
  genres?: Genre[];
}
