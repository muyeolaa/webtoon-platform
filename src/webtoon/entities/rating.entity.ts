// src/webtoon/entities/rating.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { User } from '../../user/entity/user.entity';
import { Webtoon } from './webtoon.entity';

@Entity('rating')
// 🚀 한 유저는 한 웹툰에 별점을 딱 하나만 줄 수 있음! (나중에 수정은 가능)
@Unique(['user', 'webtoon'])
export class Rating {
  @PrimaryGeneratedColumn()
  id!: number;

  // 유저가 준 별점 (예: 4.5)
  @Column({ type: 'decimal', precision: 3, scale: 1 })
  score!: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @ManyToOne(() => Webtoon, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'webtoon_id' })
  webtoon!: Webtoon;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date; // 💡 별점을 나중에 5점에서 1점으로 바꿀 수도 있으니까 수정일 추가!
}
