// src/webtoon/entities/bookmark.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { User } from '../../user/entity/user.entity'; // 🚀 유저 엔티티 경로 확인!
import { Webtoon } from './webtoon.entity';

@Entity('bookmark')
// 🚀 핵심: 같은 유저가 같은 웹툰을 여러 번 찜하는 걸 DB 차원에서 원천 차단!
@Unique(['user', 'webtoon'])
export class Bookmark {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' }) // 유저 탈퇴 시 찜 삭제
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @ManyToOne(() => Webtoon, { onDelete: 'CASCADE' }) // 웹툰 삭제 시 찜 삭제
  @JoinColumn({ name: 'webtoon_id' })
  webtoon!: Webtoon;

  @CreateDateColumn()
  createdAt!: Date;
}
