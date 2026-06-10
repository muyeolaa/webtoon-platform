// src/webtoon/entities/episode.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { Webtoon } from './webtoon.entity'; // 기존에 만든 웹툰 엔티티

@Entity('episodes')
@Unique(['titleId', 'episodeNo'])
export class Episode {
  @PrimaryGeneratedColumn()
  id?: number;

  // 어떤 웹툰의 회차인지 연결하는 부모 고유 ID (예: 네이버의 790713)
  @Column({ type: 'varchar', length: 50 })
  titleId?: string;

  // 회차 번호 (네이버 주소창에 들어가는 &no=15 부분)
  @Column({ type: 'int' })
  episodeNo?: number;

  // 회차 제목 (예: "15화 - 각성")
  @Column({ type: 'varchar', length: 255 })
  title?: string;

  // 회차 썸네일 주소
  @Column({ type: 'varchar', length: 500, nullable: true })
  thumbnailUrl?: string;

  // 업로드 날짜 (예: "2024-05-20")
  @Column({ type: 'varchar', length: 50, nullable: true })
  uploadDate?: string;

  // 🚀 카카오처럼 다이렉트 주소 규칙이 불규칙한 플랫폼을 위해 URL을 직접 저장하는 컬럼 추가!
  // nullable: true 이기 때문에, 기존에 저장된 네이버 데이터들에는 에러를 발생시키지 않습니다.
  @Column({ type: 'varchar', length: 500, nullable: true })
  url?: string;

  // --- 아래는 관계(Relation) 설정 (선택 사항이지만 해두면 엄청 편함) ---
  @ManyToOne(() => Webtoon, (webtoon) => webtoon.episodes, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'webtoon_db_id' }) // 실제 우리 DB의 웹툰 PK와 연결
  webtoon?: Webtoon;
}
