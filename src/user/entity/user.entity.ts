// src/user/user.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('user')
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  // 🚀 카카오/네이버/구글에서 받아올 이메일
  @Column({ unique: true })
  email!: string;

  // 🚀 소셜에서 받아올 닉네임 (또는 임의 생성)
  @Column()
  nickname!: string;

  // 🧹 1. 비밀번호 컬럼 영구 삭제! (더 이상 필요 없음)

  // 🧹 2. default: 'local' 삭제! 이제 무조건 소셜 이름이 들어가야 함
  @Column()
  provider!: string; // 예: 'kakao', 'naver', 'google'

  // 🧹 3. nullable: true 삭제! 소셜 로그인이면 무조건 고유 ID가 있어야 함
  @Column()
  providerId!: string;

  // 👑 관리자 권한 등급
  @Column({ default: 'USER' })
  role!: string;

  @CreateDateColumn()
  createdAt!: Date;
}
