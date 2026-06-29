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

    // =========================================================
    // 🚀 3. 실시간 평점 & 평가자 수 갱신 (베이지안 보정을 위한 필수 작업!)
    // =========================================================
    // Rating 테이블에서 이 웹툰의 '전체 평균(avg)'과 '총 평가자 수(count)'를 DB 단에서 아주 빠르게 계산해 옵니다.
    const { avg, count } = await this.ratingRepository
      .createQueryBuilder('rating')
      .select('AVG(rating.score)', 'avg')
      .addSelect('COUNT(rating.id)', 'count')
      .where('rating.webtoon_id = :webtoonId', { webtoonId: webtoon.id })
      .getRawOne();

    // 계산된 값을 Webtoon 엔티티에 업데이트 (소수점 길어지는 것 방지)
    webtoon.starRating = parseFloat(Number(avg || 0).toFixed(1));
    webtoon.starRatingCount = parseInt(count || 0, 10);

    await this.webtoonRepository.save(webtoon);
    // =========================================================

    return {
      message: '별점이 반영되었습니다.',
      myScore: score,
    };
  }
}
