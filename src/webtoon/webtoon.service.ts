// src/webtoon/webtoon.service.ts
import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ArrayContains, ILike, Brackets } from 'typeorm';
import { Webtoon } from './entities/webtoon.entity';
import { Genre } from './entities/genre.entity';
import { Episode } from './entities/episode.entity';
import { GENRE_GROUPS } from './constants/genre-whitelist';

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
    isAdult?: string,
    genre?: string,
  ) {
    const skip = (page - 1) * limit;

    const qb = this.webtoonRepository.createQueryBuilder('webtoon');

    // 1. 성인 웹툰 필터링
    if (isAdult === 'false') {
      qb.andWhere('webtoon.isAdult = :isAdultFlag', { isAdultFlag: false });
    }

    // 2. 플랫폼 필터링
    if (platform && platform !== '전체' && platform !== 'all') {
      const p =
        platform === '네이버' || platform === 'naver'
          ? 'naver'
          : platform === '카카오' || platform === 'kakao'
            ? 'kakao'
            : platform;
      qb.andWhere('webtoon.platform = :platform', { platform: p });
    }

    // 3. 검색어 또는 요일 필터링
    if (search) {
      const cleanSearch = search.replace(/\s+/g, '');
      qb.andWhere('webtoon.searchTitle ILIKE :search', {
        search: `%${cleanSearch}%`,
      });
    } else if (day) {
      // 🚀 핵심 수정 부분: 'latest(최신)'일 때의 처리
      if (day === 'latest') {
        // 프론트에서 넘어온 sort 값이 없을 때만 '최신순'을 기본값으로 줍니다.
        // 조회순, 인기순 등이 들어왔다면 덮어쓰지 않고 살려둡니다!
        if (!sort) {
          sort = '최신순';
        }

        /* 💡 추가 팁: 만약 '최신' 탭에서 옛날에 완결된 웹툰이 조회순으로 올라오는 게 싫다면,
         아래처럼 '최근 7일 이내 업데이트된 웹툰'만 걸러내는 필터를 추가할 수도 있습니다.
         (기획상 필요 없다면 주석 처리 그대로 두시면 됩니다.)
         
         const oneWeekAgo = new Date();
         oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
         qb.andWhere('webtoon.lastEpisodeUpdatedAt >= :oneWeekAgo', { oneWeekAgo });
        */
      } else {
        // 일반 요일이거나 완결일 때
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
        const englishDay = dayTranslator[day];
        if (englishDay) {
          qb.andWhere(':day = ANY(webtoon.publishDays)', { day: englishDay });
        }
      }
    }

    // 4. 장르 필터링
    // GENRE_WHITELIST 항목 그대로 매칭하면 안 되고, GENRE_GROUPS[선택한_장르]에 묶인
    // 실제 DB 태그들과 포함(substring) 매치해야 한다 (genre-whitelist.ts 주석 참고).
    if (genre && GENRE_GROUPS[genre]) {
      const keywords = GENRE_GROUPS[genre];
      const matchingWebtoonIds = this.webtoonRepository
        .createQueryBuilder('w')
        .select('w.id')
        .innerJoin('w.genres', 'g')
        .where(
          new Brackets((qb2) => {
            keywords.forEach((keyword, i) => {
              qb2.orWhere(`g.name ILIKE :genreKeyword${i}`, {
                [`genreKeyword${i}`]: `%${keyword}%`,
              });
            });
          }),
        );

      qb.andWhere(
        `webtoon.id IN (${matchingWebtoonIds.getQuery()})`,
      ).setParameters(matchingWebtoonIds.getParameters());
    }

    // 5. 다이나믹 정렬 적용
    if (sort === '조회순') {
      qb.orderBy('webtoon.viewCount', 'DESC').addOrderBy('webtoon.id', 'DESC');
    } else if (sort === '업데이트순' || sort === '최신순') {
      qb.orderBy(
        'webtoon.lastEpisodeUpdatedAt',
        'DESC',
        'NULLS LAST',
      ).addOrderBy('webtoon.id', 'DESC');
    } else if (sort === '인기순') {
      qb.orderBy('webtoon.trendingScore', 'DESC').addOrderBy(
        'webtoon.viewCount',
        'DESC',
      );
    } else if (sort === '북마크순') {
      qb.orderBy('webtoon.bookmarkCount', 'DESC').addOrderBy(
        'webtoon.trendingScore',
        'DESC',
      );
    } else if (sort === '별점순') {
      qb.orderBy(
        '((COALESCE(NULLIF(webtoon.starScore, 0), 9.0) * 100) + (webtoon.starRating * webtoon.starRatingCount)) / (100 + webtoon.starRatingCount)',
        'DESC',
      ).addOrderBy('webtoon.viewCount', 'DESC');
    } else {
      qb.orderBy('webtoon.id', 'ASC');
    }

    // 6. 데이터 가져오기
    const [webtoons, totalCount] = await qb
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    // 7. 데이터 가공
    const processedWebtoons = webtoons.map((webtoon) =>
      this.formatWebtoonCard(webtoon),
    );

    return {
      data: processedWebtoons,
      meta: {
        totalItems: totalCount,
        itemCount: processedWebtoons.length,
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
    // 1. 조회수 1 증가 (기존 로직 유지)
    await this.webtoonRepository.increment({ id }, 'viewCount', 1);

    // 2. 웹툰 상세 데이터 및 연관 데이터(에피소드, 장르) 조회
    // findOne({ relations }) 대신 leftJoinAndSelect로 명시적 JOIN해서 N+1 쿼리 방지
    const webtoon = await this.webtoonRepository
      .createQueryBuilder('webtoon')
      .leftJoinAndSelect('webtoon.episodes', 'episode')
      .leftJoinAndSelect('webtoon.genres', 'genre')
      .where('webtoon.id = :id', { id })
      .orderBy('episode.episodeNo', 'DESC')
      .getOne();

    if (!webtoon) {
      throw new NotFoundException('웹툰을 찾을 수 없습니다.');
    }

    // =========================================================
    // 📊 3. 베이지안 보정 평점 계산 로직 적용 (가짜 유저 100명 기준)
    // =========================================================
    const virtualCount = 100;

    // 🚀 1. 방어 로직 추가: 외부 평점이 0점(또는 null)이면 기본값 9.0을 부여!
    const validStarScore =
      webtoon.starScore && webtoon.starScore > 0 ? webtoon.starScore : 9.5; // 네가 생각하는 적절한 기본 평점 (9.0 ~ 9.5 추천)

    // 2. 외부 총점 계산 시 0점이 아닌 유효한 점수를 곱해줍니다.
    const externalTotalScore = validStarScore * virtualCount;

    // 우리 사이트 평점 총점
    const internalTotalScore =
      (webtoon.starRating || 0) * (webtoon.starRatingCount || 0);

    // 최종 보정 평점 계산
    const totalCount = virtualCount + (webtoon.starRatingCount || 0);
    const calculatedRating =
      (externalTotalScore + internalTotalScore) / totalCount;
    // =========================================================

    // 4. 프론트엔드가 바로 쓸 수 있도록 계산된 값을 덮어씌워서 리턴
    return {
      ...webtoon,
      // 🎯 소수점 첫째 자리까지만 예쁘게 반올림해서 기존 starScore를 대체
      starScore: Number(calculatedRating.toFixed(2)),
      // 화면에 '참여 100명 이상' 등으로 표기할 수 있게 총 평가자 수도 전달
      totalRatingCount: totalCount,
    };
  }

  // =========================================================================
  // 🚀 크롤러 전용: 상세 정보 및 다대다(N:M) 장르 연결 함수
  // =========================================================================
  async updateWebtoonDetails(
    webtoonId: string,
    description: string,
    genreNames: string[],
    isAdult?: boolean, //
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
      relations: ['webtoon'],
      order: { createdAt: 'DESC' },
    });

    return bookmarks
      .map((b) => {
        if (!b.webtoon) return null;

        // 🚀 홈페이지와 완벽하게 동일한 별점 보정 및 계산 로직!
        const virtualCount = 100;
        const validStarScore =
          b.webtoon.starScore && b.webtoon.starScore > 0
            ? b.webtoon.starScore
            : 9.5;
        const externalTotalScore = validStarScore * virtualCount;
        const internalTotalScore =
          (b.webtoon.starRating || 0) * (b.webtoon.starRatingCount || 0);
        const totalCountForRating =
          virtualCount + (b.webtoon.starRatingCount || 0);
        const calculatedRating =
          (externalTotalScore + internalTotalScore) / totalCountForRating;

        return {
          ...b.webtoon,
          starScore: Number(calculatedRating.toFixed(2)), // 🚀 가공된 최종 점수를 덮어씌움!
          createdAt: b.createdAt, // 북마크 누른 날짜 위장
        };
      })
      .filter(Boolean);
  }

  async getMyRatedWebtoons(user: any) {
    const ratings = await this.ratingRepository.find({
      where: { user: { id: user.id } },
      relations: ['webtoon'],
      order: { createdAt: 'DESC' }, // 최근에 별점 준 순서대로
    });

    return ratings
      .map((r) => {
        if (!r.webtoon) return null;
        return {
          ...r.webtoon,
          myScore: r.score,
          // 🚀 핵심: 웹툰의 생성일 대신, '내가 별점을 매긴 날짜'를 createdAt으로 위장시켜 전송!
          createdAt: r.createdAt,
        };
      })
      .filter(Boolean);
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

    // =========================================================
    // 🚀 [수정된 로직] 50개 제한 밀어내기 (안전한 slice 방식)
    // =========================================================
    // 1. 유저의 전체 시청 기록 '아이디'만 최신순으로 쫙 가져옵니다. (skip 제거!)
    const allHistories = await this.viewHistoryRepository.find({
      where: { user: { id: user.id } },
      order: { updatedAt: 'DESC' },
      select: ['id'],
    });

    // 2. 전체 기록이 50개가 넘는다면?
    if (allHistories.length > 50) {
      // 50번째 이후의 쩌리 데이터들만 배열에서 잘라냅니다.
      const excessHistories = allHistories.slice(50);

      // 지워야 할 id들만 배열로 묶어서 삭제!
      const idsToDelete = excessHistories.map((h) => h.id);

      // TypeORM 삭제 실행
      await this.viewHistoryRepository.delete(idsToDelete);
    }
    // =========================================================

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
      take: 100,
    });

    const uniqueWebtoons: any[] = [];
    const seen = new Set();

    for (const h of histories) {
      if (!h.webtoon) continue;

      if (!seen.has(h.webtoon.id)) {
        seen.add(h.webtoon.id);

        // 🚀 여기도 똑같이 별점 보정 로직 추가!
        const virtualCount = 100;
        const validStarScore =
          h.webtoon.starScore && h.webtoon.starScore > 0
            ? h.webtoon.starScore
            : 9.5;
        const externalTotalScore = validStarScore * virtualCount;
        const internalTotalScore =
          (h.webtoon.starRating || 0) * (h.webtoon.starRatingCount || 0);
        const totalCountForRating =
          virtualCount + (h.webtoon.starRatingCount || 0);
        const calculatedRating =
          (externalTotalScore + internalTotalScore) / totalCountForRating;

        uniqueWebtoons.push({
          ...h.webtoon,
          starScore: Number(calculatedRating.toFixed(2)), // 🚀 가공된 최종 점수를 덮어씌움!
          createdAt: h.updatedAt, // 마지막 시청 날짜 위장
        });
      }

      if (uniqueWebtoons.length >= 50) break;
    }

    return uniqueWebtoons;
  }
  /**
   * 🚀 해시태그 기반 맞춤 추천 웹툰 로직
   * @param currentWebtoonId 현재 보고 있는 웹툰 IDmy/recent
   * @param userId 현재 로그인한 유저 ID (로그인 안 했으면 undefined)
   * @param limit 최종적으로 보여줄 추천 개수 (기본 5개)
   */
  async getRecommendedWebtoons(
    currentWebtoonId: string,
    userId?: number,
    limit: number = 5,
  ) {
    // 1. 현재 웹툰의 장르(해시태그) 정보 가져오기
    const currentWebtoon = await this.webtoonRepository.findOne({
      where: { id: currentWebtoonId },
      relations: ['genres'],
    });

    if (
      !currentWebtoon ||
      !currentWebtoon.genres ||
      currentWebtoon.genres.length === 0
    ) {
      return []; // 장르가 없으면 추천 불가
    }

    // 현재 웹툰의 장르 ID들만 배열로 추출 (예: [1, 3, 5])
    const genreIds = currentWebtoon.genres.map((g) => g.id);

    // 2. (옵션) 로그인한 유저라면, 이미 북마크한 웹툰 ID 목록 가져오기
    let bookmarkedWebtoonIds: string[] = [];
    if (userId) {
      // 💡 Bookmark 엔티티가 있다고 가정하고 작성! (실제 북마크 테이블/엔티티 이름에 맞게 수정 필요)
      const bookmarks = await this.bookmarkRepository.find({
        where: { user: { id: userId } },
        relations: ['webtoon'],
      });
      bookmarkedWebtoonIds = bookmarks.map((b) => b.webtoon.id);
    }

    // 3. QueryBuilder로 추천 후보군(Top 20) 가져오기
    const qb = this.webtoonRepository
      .createQueryBuilder('webtoon')
      .innerJoin('webtoon.genres', 'genre') // 장르가 겹치는 것만 조인
      .where('genre.id IN (:...genreIds)', { genreIds }) // 같은 장르를 하나라도 포함하는지
      .andWhere('webtoon.id != :currentWebtoonId', { currentWebtoonId }); // 현재 보고 있는 웹툰은 제외

    // 이미 북마크한 웹툰이 있다면 그것도 추천에서 제외!
    if (bookmarkedWebtoonIds.length > 0) {
      qb.andWhere('webtoon.id NOT IN (:...bookmarkedWebtoonIds)', {
        bookmarkedWebtoonIds,
      });
    }

    // 인기순(trendingScore 또는 viewCount)으로 상위 20개만 넉넉하게 뽑아옵니다.
    const candidates = await qb
      .orderBy('webtoon.trendingScore', 'DESC')
      .addOrderBy('webtoon.viewCount', 'DESC')
      .take(20)
      .getMany();

    // 4. Node.js 메모리 단에서 후보군 섞기 (배열 랜덤 셔플)
    // DB에서 RANDOM()을 쓰는 것보다 서버 리소스 절약에 훨씬 좋습니다.
    const shuffled = candidates.sort(() => 0.5 - Math.random());

    // 5. 섞인 배열에서 최종적으로 원하는 개수(limit)만큼 잘라서 리턴!
    return shuffled.slice(0, limit);
  }

  // =========================================================================
  // 🚀 홈페이지 추천 캐러셀: 인기순 후보군을 셔플해서 10개 반환
  // =========================================================================
  async getHomepageRecommendations(genre?: string, isAdultFlag?: string) {
    const qb = this.webtoonRepository.createQueryBuilder('webtoon');

    if (isAdultFlag === 'false') {
      qb.andWhere('webtoon.isAdult = :isAdultFlag', { isAdultFlag: false });
    }

    // GENRE_GROUPS[선택한_장르] 키워드 배열 전체와 포함(substring) 매치 —
    // getPaginatedWebtoons의 장르 필터링 로직과 동일해야 리스트 필터 결과와 정합성이 맞는다.
    if (genre && GENRE_GROUPS[genre]) {
      const keywords = GENRE_GROUPS[genre];
      const matchingWebtoonIds = this.webtoonRepository
        .createQueryBuilder('w')
        .select('w.id')
        .innerJoin('w.genres', 'g')
        .where(
          new Brackets((qb2) => {
            keywords.forEach((keyword, i) => {
              qb2.orWhere(`g.name ILIKE :genreKeyword${i}`, {
                [`genreKeyword${i}`]: `%${keyword}%`,
              });
            });
          }),
        );

      qb.andWhere(
        `webtoon.id IN (${matchingWebtoonIds.getQuery()})`,
      ).setParameters(matchingWebtoonIds.getParameters());
    }

    const candidates = await qb
      .orderBy('webtoon.trendingScore', 'DESC')
      .addOrderBy('webtoon.viewCount', 'DESC')
      .take(40)
      .getMany();

    if (candidates.length === 0) return [];

    // Node.js 메모리에서 배열 셔플 (getRecommendedWebtoons와 동일 패턴)
    const shuffled = candidates.sort(() => 0.5 - Math.random());
    const picked = shuffled.slice(0, 10);

    return picked.map((webtoon) => this.formatWebtoonCard(webtoon));
  }

  // 메인 리스트 카드와 동일한 별점 가중치 공식 (getPaginatedWebtoons, getHomepageRecommendations 공용)
  private formatWebtoonCard(webtoon: Webtoon) {
    const virtualCount = 100;
    const validStarScore =
      webtoon.starScore && webtoon.starScore > 0 ? webtoon.starScore : 9.5;

    const externalTotalScore = validStarScore * virtualCount;
    const internalTotalScore =
      (webtoon.starRating || 0) * (webtoon.starRatingCount || 0);
    const totalCountForRating = virtualCount + (webtoon.starRatingCount || 0);
    const calculatedRating =
      (externalTotalScore + internalTotalScore) / totalCountForRating;

    return {
      ...webtoon,
      starScore: Number(calculatedRating.toFixed(2)),
      totalRatingCount: totalCountForRating,
    };
  }

  async getSitemapData() {
    // TypeORM을 사용 중이라고 가정하고 select로 필요한 필드만 가져옵니다.
    // 이렇게 하면 수만 개를 조회해도 메모리를 거의 쓰지 않아요!
    return await this.webtoonRepository.find({
      select: ['id', 'updatedAt'],
    });
  }
}
