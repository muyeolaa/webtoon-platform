import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
// 💡 User 엔티티 경로는 본인 프로젝트에 맞게 수정해 주세요! (예: src/user/entities/user.entity)
import { User } from '../../user/entity/user.entity';

@Entity('board')
export class Board {
  @PrimaryGeneratedColumn()
  id!: number;

  // 'NOTICE' (공지사항) 또는 'BUG' (버그 제보)
  @Column()
  category!: string;

  @Column()
  title!: string;

  @Column('text')
  content!: string;

  // 비밀글 여부 (버그 제보는 무조건 true로 강제 고정!)
  @Column({ default: false })
  isSecret!: boolean;

  // 누가 썼는지 기록 (회원 탈퇴 시 작성한 게시글도 날리려면 CASCADE 유지)
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  author!: User;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
