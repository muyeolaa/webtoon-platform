// src/webtoon/webtoon.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { WebtoonService } from './webtoon.service';
import { Webtoon } from './entities/webtoon.entity';
import { Episode } from './entities/episode.entity';
import { Genre } from './entities/genre.entity';
import { ViewHistory } from './entities/view-history.entity';
import { Bookmark } from './entities/bookmark.entity';
import { Rating } from './entities/rating.entity';

describe('WebtoonService', () => {
  let service: WebtoonService;
  let qbMock: any;
  let webtoonRepository: { createQueryBuilder: jest.Mock };

  beforeEach(async () => {
    qbMock = {
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      setParameters: jest.fn().mockReturnThis(),
      getQuery: jest.fn().mockReturnValue('SELECT w.id FROM webtoon w'),
      getParameters: jest.fn().mockReturnValue({}),
      getMany: jest.fn(),
    };

    webtoonRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(qbMock),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebtoonService,
        { provide: getRepositoryToken(Webtoon), useValue: webtoonRepository },
        { provide: getRepositoryToken(Episode), useValue: {} },
        { provide: getRepositoryToken(Genre), useValue: {} },
        { provide: getRepositoryToken(ViewHistory), useValue: {} },
        { provide: getRepositoryToken(Bookmark), useValue: {} },
        { provide: getRepositoryToken(Rating), useValue: {} },
      ],
    }).compile();

    service = module.get(WebtoonService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('getHomepageRecommendations', () => {
    const makeWebtoon = (id: string, overrides: Partial<Webtoon> = {}) =>
      ({
        id,
        titleName: `웹툰${id}`,
        author: '작가',
        platform: 'naver',
        thumbnailUrl: 'https://example.com/thumb.png',
        isAdult: false,
        starScore: 9,
        starRating: 0,
        starRatingCount: 0,
        trendingScore: 100,
        viewCount: 1000,
        ...overrides,
      }) as Webtoon;

    it('후보군이 10개 초과이면 정확히 10개만 반환한다', async () => {
      const candidates = Array.from({ length: 40 }, (_, i) =>
        makeWebtoon(String(i)),
      );
      qbMock.getMany.mockResolvedValue(candidates);

      const result = await service.getHomepageRecommendations();

      expect(result).toHaveLength(10);
      expect(qbMock.take).toHaveBeenCalledWith(40);
    });

    it('후보군이 10개 미만이면 있는 만큼만 반환한다', async () => {
      const candidates = [makeWebtoon('1'), makeWebtoon('2')];
      qbMock.getMany.mockResolvedValue(candidates);

      const result = await service.getHomepageRecommendations();

      expect(result).toHaveLength(2);
    });

    it('후보군이 0개이면 빈 배열을 반환한다', async () => {
      qbMock.getMany.mockResolvedValue([]);

      const result = await service.getHomepageRecommendations();

      expect(result).toEqual([]);
    });

    it('isAdultFlag가 false 문자열이면 성인 필터 조건을 추가한다', async () => {
      qbMock.getMany.mockResolvedValue([]);

      await service.getHomepageRecommendations(undefined, 'false');

      expect(qbMock.andWhere).toHaveBeenCalledWith(
        'webtoon.isAdult = :isAdultFlag',
        { isAdultFlag: false },
      );
    });

    it('등록되지 않은 genre가 오면 장르 서브쿼리를 추가하지 않는다', async () => {
      qbMock.getMany.mockResolvedValue([]);

      await service.getHomepageRecommendations('없는장르');

      expect(qbMock.where).not.toHaveBeenCalled();
    });

    it('등록된 genre가 오면 GENRE_GROUPS 키워드로 서브쿼리를 건다', async () => {
      qbMock.getMany.mockResolvedValue([]);

      await service.getHomepageRecommendations('회귀');

      // GENRE_GROUPS['회귀'] = ['회귀', '환생', '빙의'] -> genre.name ILIKE 서브쿼리 where 호출
      expect(qbMock.where).toHaveBeenCalled();
      expect(qbMock.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('webtoon.id IN'),
      );
    });

    it('응답 카드는 getPaginatedWebtoons와 동일한 starScore 가중치 공식을 사용한다', async () => {
      const candidates = [
        makeWebtoon('1', {
          starScore: 9.5,
          starRating: 8,
          starRatingCount: 50,
        }),
      ];
      qbMock.getMany.mockResolvedValue(candidates);

      const [card] = await service.getHomepageRecommendations();

      // (9.5*100 + 8*50) / (100+50) = (950+400)/150 = 9.0
      expect(card.starScore).toBe(9);
      expect(card.totalRatingCount).toBe(150);
    });
  });
});
