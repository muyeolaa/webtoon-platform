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

    // 🚀 3. 핵심 로직: 이 웹툰의 '평균 별점' 다시 계산하기!
    // TypeORM의 쿼리 빌더를 써서 DB한테 "이 웹툰의 score 평균(AVG) 좀 구해줘!" 라고 시킴
    const { average } = await this.ratingRepository
      .createQueryBuilder('rating')
      .select('AVG(rating.score)', 'average')
      .where('rating.webtoon_id = :webtoonId', { webtoonId })
      .getRawOne();

    // 🚀 4. 웹툰 테이블에 평균 점수 저장하기 (소수점 둘째 자리에서 반올림)
    // DB에서 AVG를 구하면 가끔 문자열(String)로 넘어올 때가 있어서 Number로 감싸주는 게 안전해!
    webtoon.starScore = Math.round(Number(average) * 100) / 100;
    await this.webtoonRepository.save(webtoon);

    return {
      message: '별점이 반영되었습니다.',
      myScore: score,
      webtoonAverage: webtoon.starScore, // 프론트엔드가 바로 화면에 업데이트할 수 있게 돌려줌
    };
  }
}
