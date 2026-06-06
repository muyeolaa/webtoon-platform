import { Entity, PrimaryGeneratedColumn, Column, ManyToMany } from 'typeorm';
import { Webtoon } from './webtoon.entity';

@Entity('genre') // DB에 생성될 테이블 이름
export class Genre {
  @PrimaryGeneratedColumn()
  id!: number;

  // 🚀 핵심: 같은 이름의 장르가 2개 이상 생기지 않도록 방어막(unique)을 칩니다!
  @Column({ unique: true })
  name!: string;

  // 장르 입장에서도 "나를 가지고 있는 웹툰들"을 양방향으로 알 수 있게 연결해 줍니다.
  @ManyToMany(() => Webtoon, (webtoon) => webtoon.genres)
  webtoons?: Webtoon[];
}
