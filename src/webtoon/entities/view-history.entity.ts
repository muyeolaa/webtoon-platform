import {
  Entity,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Webtoon } from './webtoon.entity';
// 💡 User 엔티티 경로는 기존 bookmark.entity.ts 파일에 있는 걸 그대로 복사해서 맞춰주세요!
import { User } from '../../user/entity/user.entity';

@Entity('view_history')
export class ViewHistory {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @ManyToOne(() => Webtoon, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'webtoon_id' })
  webtoon!: Webtoon;

  @CreateDateColumn()
  createdAt!: Date;

  // 🚀 핵심 마법: 똑같은 웹툰을 또 보면 이 '수정 시간'만 현재 시간으로 갱신됩니다!
  @UpdateDateColumn()
  updatedAt!: Date;
}
