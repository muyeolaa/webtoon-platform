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

  @Column({ unique: true }) // 🚀 중복 가입 원천 차단!
  email!: string;

  @Column()
  nickname!: string;

  // 소셜 로그인 유저는 비밀번호가 없으므로 nullable: true
  @Column({ nullable: true })
  password?: string;

  // 'local' | 'kakao' | 'naver' 등 가입 출처
  @Column({ default: 'local' })
  provider!: string;

  // 소셜 로그인 시 발급받는 고유 ID
  @Column({ nullable: true })
  providerId?: string;

  @Column({ default: 'USER' })
  role!: string;

  @CreateDateColumn()
  createdAt!: Date;
}
