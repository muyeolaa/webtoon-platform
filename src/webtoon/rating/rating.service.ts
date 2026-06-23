// src/webtoon/rating/rating.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Rating } from '../entities/rating.entity';
import { Webtoon } from '../entities/webtoon.entity';
import { User } from '../../user/entity/user.entity';

@Injectable()
export class RatingService {
  constructor(
    @InjectRepository(Rating)
    private ratingRepository: Repository<Rating>,
    @InjectRepository(Webtoon)
    private webtoonRepository: Repository<Webtoon>,
  ) {}

  async rateWebtoon(user: User, webtoonId: string, score: number) {
    // 1. 웹툰이 진짜 있는지 확인
    const webtoon = await this.webtoonRepository.findOne({
      where: { id: webtoonId },
    });

    if (!webtoon) {
      throw new NotFoundException('존재하지 않는 웹툰입니다.');
    }

    // 2. 이 유저가 이미 별점을 준 적 있는지 확인
    let rating = await this.ratingRepository.findOne({
      where: { user: { id: user.id }, webtoon: { id: webtoonId } },
    });

    if (rating) {
      // 이미 줬다면 새로운 점수로 덮어쓰기 (수정)
      rating.score = score;
      await this.ratingRepository.save(rating);
    } else {
      // 처음 주는 거라면 새로 생성
      rating = this.ratingRepository.create({ user, webtoon, score });
      await this.ratingRepository.save(rating);
    }

    // 🚀 실시간 계산 로직 통째로 제거!
    // 이제 저장만 하고 가볍게 빛의 속도로 응답을 돌려줍니다.
    return {
      message: '별점이 반영되었습니다.',
      myScore: score,
    };
  }
}
