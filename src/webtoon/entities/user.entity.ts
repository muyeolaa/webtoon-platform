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
  id!: number; // 우리 DB의 고유 유저 번호 (1, 2, 3...)

  // 1. 공통 정보
  @Column({ unique: true })
  email!: string;

  @Column()
  nickname!: string; // 인벤 닉네임 같은 것

  // 2. 일반(로컬) 로그인 전용
  // 💡 카카오로 가입한 사람은 비번이 없으니까 nullable: true 처리!
  @Column({ nullable: true })
  password?: string;

  // 3. 소셜 로그인 전용 (어디서 굴러온(?) 유저인지 출처 표시)
  // 예: 'local', 'kakao', 'naver', 'google'
  @Column({ default: 'local' })
  provider!: string;

  // 카카오나 구글에서 발급해 준 그들만의 고유 ID 번호
  @Column({ nullable: true })
  providerId?: string;

  @CreateDateColumn()
  createdAt!: Date;
}
