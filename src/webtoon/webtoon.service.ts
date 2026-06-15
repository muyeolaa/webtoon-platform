// src/webtoon/webtoon.service.ts
import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ArrayContains, ILike } from 'typeorm';
import { Webtoon } from './entities/webtoon.entity';
import { Genre } from './entities/genre.entity';
import { Episode } from './entities/episode.entity'; // 🚀 Episod

// 1초, 2초 기다리게 만드는 커스텀 함수
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

@Injectable()
export class WebtoonService {
  private readonly logger = new Logger(WebtoonService.name);

  constructor(
    @InjectRepository(Webtoon)
    private readonly webtoonRepository: Repository<Webtoon>,
    @InjectRepository(Episode)
    private readonly episodeRepository: Repository<Episode>,

    @InjectRepository(Genre)
    private readonly genreRepository: Repository<Genre>,
  ) {}

  async findAllWebtoons() {
    return await this.webtoonRepository.find();
  }

  // =========================================================================
  // 🚀 페이징 및 다중 필터 검색 기능
  // =========================================================================
  async getPaginatedWebtoons(
    page: number = 1,
    limit: number = 21,
    platform?: string,
    day?: string,
    sort?: string,
    search?: string,
  ) {
    const skip = (page - 1) * limit;
    const where: any = {};

    const dayTranslator: Record<string, string> = {
      mon: 'MONDAY',
      tue: 'TUESDAY',
      wed: 'WEDNESDAY',
      thu: 'THURSDAY',
      fri: 'FRIDAY',
      sat: 'SATURDAY',
      sun: 'SUNDAY',
      end: 'FINISHED',
    };

    if (platform && platform !== '전체' && platform !== 'all') {
      if (platform === '네이버' || platform === 'naver') {
        where.platform = 'naver';
      } else if (platform === '카카오' || platform === 'kakao') {
        where.platform = 'kakao';
      } else {
        where.platform = platform;
      }
    }

    if (search) {
      where.titleName = ILike(`%${search}%`);
    } else {
      if (day) {
        const englishDay = dayTranslator[day];
        if (englishDay) {
          where.publishDays = ArrayContains([englishDay]);
        }
      }
    }

    let order: any = { id: 'ASC' };
    if (sort === '조회순') {
      order = { viewCount: 'DESC' };
    } else if (sort === '업데이트순') {
      order = { updatedAt: 'DESC' };
    } else if (sort === '인기순') {
      order = { starRating: 'DESC' };
    }

    const [webtoons, totalCount] = await this.webtoonRepository.findAndCount({
      where: where,
      skip: skip,
      take: limit,
      order: order,
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

  // =========================================================================
  // 🚀 단일 웹툰 상세 조회 (회차, 장르 포함)
  // =========================================================================
  async getWebtoonDetail(id: string) {
    return await this.webtoonRepository.findOne({
      where: { id },
      relations: ['episodes', 'genres'],
      order: {
        episodes: {
          episodeNo: 'DESC',
        },
      },
    });
  }

  // =========================================================================
  // 🚀 크롤러 전용: 상세 정보 및 다대다(N:M) 장르 연결 함수
  // =========================================================================
  async updateWebtoonDetails(
    webtoonId: string,
    description: string,
    genreNames: string[],
    isAdult?: boolean,
  ) {
    // 1. 업데이트할 웹툰 찾기
    // 💡 핵심 방어막: 기존에 연결된 장르(relations: ['genres'])도 같이 가져와야
    // TypeORM이 덮어쓰기 할 때 중간 테이블(webtoon_genres)이 꼬이지 않아요!
    const webtoon = await this.webtoonRepository.findOne({
      where: { id: webtoonId },
      relations: ['genres'],
    });

    if (!webtoon) {
      this.logger.warn(`⚠️ ID가 ${webtoonId}인 웹툰을 찾을 수 없습니다.`);
      return;
    }

    // 🚀 2. [수정된 핵심 로직] 공백 먼저 싹 자르고, 빈칸 버리고, 깨끗한 상태에서 중복 제거!
    const cleanedNames = genreNames
      .map((name) => name.trim())
      .filter((name) => name !== ''); // 빈 문자열 제거

    const uniqueGenreNames = [...new Set(cleanedNames)]; // 중복 완벽 제거

    const genres: Genre[] = [];

    // 3. 깨끗해진 해시태그 배열(uniqueGenreNames)을 하나씩 검사 및 생성
    for (const cleanName of uniqueGenreNames) {
      let genre = await this.genreRepository.findOne({
        where: { name: cleanName },
      });

      if (!genre) {
        genre = this.genreRepository.create({ name: cleanName });
        genre = await this.genreRepository.save(genre);
      }

      genres.push(genre);
    }

    // 4. 웹툰에 소개글과 완성된 장르 배열 장착!
    webtoon.description = description;
    webtoon.genres = genres;

    // 상세 API에서 성인 여부가 넘어왔다면 DB 업데이트!
    if (isAdult !== undefined) {
      webtoon.isAdult = isAdult;
    }

    // 5. 최종 저장
    const updatedWebtoon = await this.webtoonRepository.save(webtoon);
    return updatedWebtoon;
  }

  // =========================================================================
  // 🚀 [딥링크] 특정 회차의 실제 플랫폼 URL 가져오기  // 딥링크
  // =========================================================================
  async getEpisodeUrl(episodeId: any): Promise<string> {
    // 💡 타입을 임시로 any로 변경!

    console.log(
      `[디버깅 1] 프론트에서 넘어온 ID:`,
      episodeId,
      `(타입: ${typeof episodeId})`,
    );

    const episode = await this.episodeRepository.findOne({
      where: { id: episodeId },
      select: ['id', 'url'], // id도 같이 꺼내와보자
    });

    console.log(`[디버깅 2] DB에서 찾은 결과:`, episode);

    if (!episode) {
      console.log(`[디버깅 3] 에러 원인: DB에서 해당 ID를 아예 못 찾음!`);
      throw new NotFoundException('해당 회차의 링크 정보가 존재하지 않습니다.');
    }

    if (!episode.url) {
      console.log(`[디버깅 3] 에러 원인: 데이터는 찾았는데 url 칸이 비어있음!`);
      throw new NotFoundException('해당 회차의 링크 정보가 존재하지 않습니다.');
    }

    return episode.url;
  }
}
