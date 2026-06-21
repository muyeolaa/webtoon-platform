// src/webtoon/webtoon.service.ts
import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ArrayContains, ILike } from 'typeorm';
import { Webtoon } from './entities/webtoon.entity';
import { Genre } from './entities/genre.entity';
import { Episode } from './entities/episode.entity';

// 🚀 1. 방금 모듈에 등록하기로 한 북마크, 별점 엔티티 불러오기!
import { Bookmark } from './entities/bookmark.entity';
import { Rating } from './entities/rating.entity';
import { ViewHistory } from './entities/view-history.entity';

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
    @InjectRepository(ViewHistory)
    private readonly viewHistoryRepository: Repository<ViewHistory>,

    // 🚀 2. 북마크와 별점 저장소(Repository)를 사용할 수 있게 주입!
    @InjectRepository(Bookmark)
    private readonly bookmarkRepository: Repository<Bookmark>,
    @InjectRepository(Rating)
    private readonly ratingRepository: Repository<Rating>,
  ) {}

  async findAllWebtoons() {
    return await this.webtoonRepository.find();
  }

  // =========================================================================
  // 🚀 [신규 추가!] 내 활동 기록 (찜 여부, 내가 준 별점) 통합 조회
  // =========================================================================
  async getMyActivity(webtoonId: string, user: any) {
    // 1. 이 유저가 이 웹툰을 찜했는지 찾기
    const bookmark = await this.bookmarkRepository.findOne({
      where: { user: { id: user.id }, webtoon: { id: webtoonId } },
    });

    // 2. 이 유저가 이 웹툰에 준 별점이 있는지 찾기
    const rating = await this.ratingRepository.findOne({
      where: { user: { id: user.id }, webtoon: { id: webtoonId } },
    });

    // 3. 찾은 결과를 프론트가 쓰기 좋게 예쁘게 포장해서 던져주기!
    return {
      isBookmarked: !!bookmark, // 데이터가 있으면 true, 없으면 false
      myRating: rating ? rating.score : 0, // 데이터가 있으면 그 점수, 없으면 0점
    };
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
    lastEpisodeUpdatedAt?: Date | null, // 🚀 4번째 자리에 '최신 연재일'을 받도록 추가!
    isAdult?: boolean, // 💡 기존 4번째였던 '성인 여부'는 5번째로 자연스럽게 양보
  ) {
    const webtoon = await this.webtoonRepository.findOne({
      where: { id: webtoonId },
      relations: ['genres'],
    });

    if (!webtoon) {
      this.logger.warn(`⚠️ ID가 ${webtoonId}인 웹툰을 찾을 수 없습니다.`);
      return;
    }

    const cleanedNames = genreNames
      .map((name) => name.trim())
      .filter((name) => name !== '');

    const uniqueGenreNames = [...new Set(cleanedNames)];

    const genres: Genre[] = [];

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

    // 1. 기본 정보 덮어씌우기
    webtoon.description = description;
    webtoon.genres = genres;

    // 🚀 2. 크롤러가 날짜를 찾아왔다면 DB 엔티티에 쏙!
    if (lastEpisodeUpdatedAt) {
      webtoon.lastEpisodeUpdatedAt = lastEpisodeUpdatedAt;
    }

    // 3. 성인 여부 덮어씌우기
    if (isAdult !== undefined) {
      webtoon.isAdult = isAdult;
    }

    const updatedWebtoon = await this.webtoonRepository.save(webtoon);
    return updatedWebtoon;
  }

  // =========================================================================
  // 🚀 [딥링크] 특정 회차의 실제 플랫폼 URL 가져오기
  // =========================================================================
  async getEpisodeUrl(episodeId: any): Promise<string> {
    console.log(
      `[디버깅 1] 프론트에서 넘어온 ID:`,
      episodeId,
      `(타입: ${typeof episodeId})`,
    );

    const episode = await this.episodeRepository.findOne({
      where: { id: episodeId },
      select: ['id', 'url'],
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

  async getMyBookmarkedWebtoons(user: any) {
    const bookmarks = await this.bookmarkRepository.find({
      where: { user: { id: user.id } },
      relations: ['webtoon'], // 💡 찜 기록뿐만 아니라 실제 웹툰 정보까지 같이 가져오기!
      order: { createdAt: 'DESC' }, // 최근에 찜한 순서대로 정렬
    });

    // 프론트엔드에서 쓰기 편하도록 찜 기록 껍데기는 버리고 '웹툰 알맹이'만 쏙 빼서 배열로 리턴!
    return bookmarks.map((b) => b.webtoon);
  }

  async getMyRatedWebtoons(user: any) {
    const ratings = await this.ratingRepository.find({
      where: { user: { id: user.id } },
      relations: ['webtoon'],
      order: { createdAt: 'DESC' }, // 최근에 별점을 준 순서대로
    });

    // 프론트엔드에서 쓰기 편하게 웹툰 데이터 안에 'myScore'라는 이름으로 내 점수를 끼워 넣어줍니다!
    return ratings.map((r) => ({
      ...r.webtoon,
      myScore: r.score,
    }));
  }
  // =========================================================================
  // 🚀 [신규 추가] 최근 본 웹툰 기록 저장 (Upsert 방식)
  // =========================================================================
  async saveViewHistory(user: any, webtoonId: string) {
    let history = await this.viewHistoryRepository.findOne({
      where: { user: { id: user.id }, webtoon: { id: webtoonId } },
    });

    if (history) {
      // 이미 본 적이 있으면, updatedAt 시간만 현재로 갱신! (맨 위로 끌어올리기)
      history.updatedAt = new Date();
      await this.viewHistoryRepository.save(history);
    } else {
      // 처음 보는 웹툰이면 새로 기록 생성!
      history = this.viewHistoryRepository.create({
        user: { id: user.id },
        webtoon: { id: webtoonId },
      });
      await this.viewHistoryRepository.save(history);
    }
    return { success: true };
  }

  // =========================================================================
  // 🚀 [신규 추가] 최근 본 웹툰 목록 조회
  // =========================================================================
  async getMyRecentWebtoons(user: any) {
    const histories = await this.viewHistoryRepository.find({
      where: { user: { id: user.id } },
      relations: ['webtoon'],
      order: { updatedAt: 'DESC' },
      take: 100, // 💡 혹시 모를 중복을 대비해 넉넉하게 100개를 가져옵니다.
    });

    const uniqueWebtoons: Webtoon[] = [];
    const seen = new Set(); // 🚀 이미 본 웹툰 ID를 기억하는 메모장 (중복 제거 핵심)

    for (const h of histories) {
      if (!h.webtoon) continue; // 웹툰 정보가 날아간 고아 데이터 방어

      // 메모장에 없는 웹툰만 결과 배열에 쏙!
      if (!seen.has(h.webtoon.id)) {
        seen.add(h.webtoon.id);
        uniqueWebtoons.push(h.webtoon);
      }

      // 50개가 꽉 차면 더 이상 안 찾아도 됨
      if (uniqueWebtoons.length >= 50) break;
    }

    return uniqueWebtoons;
  }
}
