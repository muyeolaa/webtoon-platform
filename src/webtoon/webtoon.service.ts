// src/webtoon/webtoon.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ArrayContains, ILike } from 'typeorm';
import { Webtoon } from './entities/webtoon.entity';

// 1초, 2초 기다리게 만드는 커스텀 함수
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

@Injectable()
export class WebtoonService {
  constructor(
    @InjectRepository(Webtoon)
    private readonly webtoonRepository: Repository<Webtoon>,
  ) {}

  async findAllWebtoons() {
    return await this.webtoonRepository.find();
  }

  // 🚀 필터링 옵션(platform, day, sort)을 매개변수에 추가합니다.
  async getPaginatedWebtoons(
    page: number = 1,
    limit: number = 21,
    platform?: string,
    day?: string,
    sort?: string,
    search?: string,
  ) {
    const skip = (page - 1) * limit;

    // 🔍 1. 동적 WHERE 조건문 조립하기
    const where: any = {};

    // 🚀 1. 프론트엔드의 한글을 DB의 영어로 바꿔주는 번역기(사전)를 만듭니다.
    const dayTranslator: Record<string, string> = {
      mon: 'MONDAY',
      tue: 'TUESDAY',
      wed: 'WEDNESDAY',
      thu: 'THURSDAY',
      fri: 'FRIDAY',
      sat: 'SATURDAY',
      sun: 'SUNDAY',
      end: 'FINISHED', // 💡 DB에 저장된 완결 웹툰의 상태값으로 맞춰주세요.
    };

    if (platform && platform !== '전체') {
      // 프론트엔드에서 한글('네이버')로 보낼 수도 있고 영문('naver')으로 보낼 수도 있으니
      // 네 DB에 저장된 형식에 맞춰 가공하는 로직이 필요할 수 있습니다.
      // 여기서는 프론트가 보낸 문자열 그대로 DB에서 매칭합니다.
      where.platform = platform;
      if (platform === '네이버') where.platform = 'naver';
      if (platform === '카카오') where.platform = 'kakao';
    }

    if (day) {
      // 🚀 2. 번역기를 돌려서 진짜 DB용 영어 단어를 찾습니다. (예: '월' -> 'MONDAY')
      const englishDay = dayTranslator[day];

      if (englishDay) {
        // 번역된 영어 단어로 DB에 포함 여부를 묻습니다!
        where.publishDays = ArrayContains([englishDay]);
      }
    }

    if (search) {
      // `%` 기호는 "이 앞뒤로 무슨 글자가 오든 상관없다"는 뜻의 와일드카드입니다.
      // 예: "%나혼자%" -> "나혼자만 레벨업", "나혼자 산다" 모두 검색됨
      where.titleName = ILike(`%${search}%`);
    }

    // 📊 2. 동적 ORDER BY 정렬문 조립하기
    let order: any = { id: 'ASC' }; // 기본 정렬값

    // ⚠️ 주의: 네 DB 컬럼명(예: viewCount, starRating, updatedAt)에 맞게 아래 명칭을 수정해야 합니다!
    if (sort === '조회순') {
      order = { viewCount: 'DESC' };
    } else if (sort === '업데이트순') {
      order = { updatedAt: 'DESC' };
    } else if (sort === '인기순') {
      order = { starRating: 'DESC' };
    }

    // 3. 조건들이 반영된 마법의 마스터키 실행
    const [webtoons, totalCount] = await this.webtoonRepository.findAndCount({
      where: where, // 필터 조건 적용!
      skip: skip,
      take: limit,
      order: order, // 정렬 조건 적용!
    });

    return {
      data: webtoons,
      meta: {
        totalItems: totalCount,
        itemCount: webtoons.length,
        itemsPerPage: limit,
        totalPages: Math.ceil(totalCount / limit),
        currentPage: page,
      },
    };
  }
}
