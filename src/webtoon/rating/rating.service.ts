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
    const webtoon = await this.webtoonRepository.findOne({
      where: { id: webtoonId },
    });

    if (!webtoon) {
      throw new NotFoundException('존재하지 않는 웹툰입니다.');
    }

    const rating = await this.ratingRepository.findOne({
      where: { user: { id: user.id }, webtoon: { id: webtoonId } },
    });

    // =========================================================
    // 🚀 1. 토글형 취소 로직 적용: 0점이 들어오면 삭제!
    // =========================================================
    if (score === 0) {
      if (rating) {
        await this.ratingRepository.remove(rating); // DB에서 아예 기록 삭제
      }
    } else {
      // 0점이 아니면 기존처럼 수정하거나 새로 생성
      if (rating) {
        rating.score = score;
        await this.ratingRepository.save(rating);
      } else {
        const newRating = this.ratingRepository.create({
          user,
          webtoon,
          score,
        });
        await this.ratingRepository.save(newRating);
      }
    }

    // =========================================================
    // 🚀 2. 실시간 평점 & 평가자 수 갱신 (취소되었으니 다시 계산)
    // =========================================================
    const { avg, count } = await this.ratingRepository
      .createQueryBuilder('rating')
      .select('AVG(rating.score)', 'avg')
      .addSelect('COUNT(rating.id)', 'count')
      .where('rating.webtoon_id = :webtoonId', { webtoonId: webtoon.id })
      .getRawOne();

    // 💡 모두가 취소해서 count가 0이 되면 avg는 null이 되므로 0으로 안전하게 치환
    webtoon.starRating = parseFloat(Number(avg || 0).toFixed(1));
    webtoon.starRatingCount = parseInt(count || 0, 10);

    await this.webtoonRepository.save(webtoon);
    // =========================================================

    return {
      message:
        score === 0 ? '별점이 취소되었습니다.' : '별점이 반영되었습니다.',
      myScore: score, // 프론트엔드 상태 업데이트를 위해 그대로 돌려줌
    };
  }
}
