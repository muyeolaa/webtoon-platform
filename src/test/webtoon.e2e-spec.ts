// test/webtoon.e2e-spec.ts
// 웹툰 목록 조회 및 북마크 추가/삭제 API에 대한 Supertest 기반 E2E(통합) 테스트.
// 실제 Postgres 대신 인메모리 페이크 레포지토리를 주입해, 외부 DB 없이도
// "HTTP 요청 -> Guard -> Controller -> Service -> 응답 JSON 규격"의 전체 흐름을 검증한다.
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import type { App } from 'supertest/types';

import { WebtoonController } from '../webtoon/webtoon.controller';
import { BookmarkController } from '../webtoon/bookmark/bookmark.controller';
import { WebtoonService } from '../webtoon/webtoon.service';
import { BookmarkService } from '../webtoon/bookmark/bookmark.service';
import { OptionalAuthGuard } from '../webtoon/guards/optional-auth.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtStrategy } from '../auth/jwt.strategy';
import { NaverCrawlerService } from '../webtoon/crawler/naver-crawler.service';
import { KakaoCrawlerService } from '../webtoon/crawler/kakao-crawler.service';
import { NaverEpisodeCrawlerService } from '../webtoon/crawler/naver-episode-crawler.service';
import { WebtoonSchedulerService } from '../webtoon/crawler/webtoon-scheduler.service';
import { KakaoEpisodeCrawlerService } from '../webtoon/crawler/kakao-episode-crawler.service';
import { LezhinCrawlerService } from '../webtoon/crawler/lezhin-crawler.service';
import { LezhinEpisodeCrawlerService } from '../webtoon/crawler/lezhin-episode-crawler.service';
import { Webtoon } from '../webtoon/entities/webtoon.entity';
import { Episode } from '../webtoon/entities/episode.entity';
import { Genre } from '../webtoon/entities/genre.entity';
import { Bookmark } from '../webtoon/entities/bookmark.entity';
import { Rating } from '../webtoon/entities/rating.entity';
import { ViewHistory } from '../webtoon/entities/view-history.entity';
import { User } from '../user/entity/user.entity';
import { AllExceptionsFilter } from '../common/filters/all-exceptions.filter';
import { TransformInterceptor } from '../common/interceptors/transform.interceptor';

const JWT_SECRET = 'e2e-test-secret';

// TypeORM where 절({id: x} 또는 {user:{id:x}} 같은 관계 shorthand)을 흉내내는 아주 단순한 매처
function matchesWhere(row: any, where: any): boolean {
  if (!where) return true;
  return Object.entries(where).every(([key, cond]: [string, any]) => {
    if (cond && typeof cond === 'object' && 'id' in cond) {
      return row[key]?.id === cond.id;
    }
    return row[key] === cond;
  });
}

function makeFakeRepo(seed: any[] = []) {
  const rows: any[] = [...seed];
  return {
    rows,
    find: jest.fn(async () => rows),
    findOne: jest.fn(
      async (opts: any) =>
        rows.find((r) => matchesWhere(r, opts?.where)) ?? null,
    ),
    create: jest.fn((entity: any) => entity),
    save: jest.fn(async (entity: any) => {
      rows.push(entity);
      return entity;
    }),
    remove: jest.fn(async (entity: any) => {
      const idx = rows.indexOf(entity);
      if (idx >= 0) rows.splice(idx, 1);
      return entity;
    }),
    increment: jest.fn(async () => undefined),
    createQueryBuilder: jest.fn(() => {
      const qb: any = {
        andWhere: () => qb,
        orderBy: () => qb,
        addOrderBy: () => qb,
        skip: () => qb,
        take: () => qb,
        where: () => qb,
        leftJoinAndSelect: () => qb,
        innerJoin: () => qb,
        getManyAndCount: async () => [rows, rows.length],
        getMany: async () => rows,
        getOne: async () => rows[0] ?? null,
      };
      return qb;
    }),
  };
}

describe('Webtoon API (e2e)', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;

  const testUser = {
    id: 1,
    email: 'tester@example.com',
    nickname: 'tester',
    role: 'user',
  };
  const testWebtoon = {
    id: 'naver_1',
    titleId: '1',
    titleName: '테스트 웹툰',
    author: '작가',
    thumbnailUrl: 'https://example.com/thumb.png',
    platform: 'naver',
    isAdult: false,
    starScore: 9,
    starRating: 0,
    starRatingCount: 0,
    viewCount: 0,
    bookmarkCount: 0,
    publishDays: ['MONDAY'],
  };

  let bookmarkRepo: ReturnType<typeof makeFakeRepo>;

  beforeAll(async () => {
    const webtoonRepo = makeFakeRepo([testWebtoon]);
    bookmarkRepo = makeFakeRepo([]);
    const userRepo = makeFakeRepo([testUser]);

    const moduleBuilder: TestingModule = await Test.createTestingModule({
      imports: [
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({ secret: JWT_SECRET }),
      ],
      controllers: [WebtoonController, BookmarkController],
      providers: [
        WebtoonService,
        BookmarkService,
        OptionalAuthGuard,
        JwtAuthGuard,
        JwtStrategy,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) =>
              key === 'JWT_SECRET' ? JWT_SECRET : undefined,
          },
        },
        { provide: getRepositoryToken(Webtoon), useValue: webtoonRepo },
        { provide: getRepositoryToken(Episode), useValue: makeFakeRepo([]) },
        { provide: getRepositoryToken(Genre), useValue: makeFakeRepo([]) },
        { provide: getRepositoryToken(Bookmark), useValue: bookmarkRepo },
        { provide: getRepositoryToken(Rating), useValue: makeFakeRepo([]) },
        {
          provide: getRepositoryToken(ViewHistory),
          useValue: makeFakeRepo([]),
        },
        { provide: getRepositoryToken(User), useValue: userRepo },
        // 목록 조회 API에는 필요 없는 크롤러 의존성들은 빈 객체로 대체
        { provide: NaverCrawlerService, useValue: {} },
        { provide: KakaoCrawlerService, useValue: {} },
        { provide: NaverEpisodeCrawlerService, useValue: {} },
        { provide: WebtoonSchedulerService, useValue: {} },
        { provide: KakaoEpisodeCrawlerService, useValue: {} },
        { provide: LezhinCrawlerService, useValue: {} },
        { provide: LezhinEpisodeCrawlerService, useValue: {} },
      ],
    }).compile();

    app = moduleBuilder.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalInterceptors(new TransformInterceptor());
    await app.init();

    jwtService = moduleBuilder.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /webtoon/list -> 200, {statusCode, message, data} 규격으로 응답한다', async () => {
    const res = await request(app.getHttpServer())
      .get('/webtoon/list')
      .expect(200);

    expect(res.body).toMatchObject({ statusCode: 200, message: 'success' });
    expect(res.body.data.data[0]).toMatchObject({
      id: 'naver_1',
      platform: 'naver',
    });
  });

  it('로그인 없이 북마크를 시도하면 401을 반환한다', async () => {
    await request(app.getHttpServer())
      .post('/webtoon/naver_1/bookmark')
      .expect(401);
  });

  it('POST /webtoon/:id/bookmark -> 로그인 유저가 찜하기/찜 취소를 토글한다', async () => {
    const token = jwtService.sign({ sub: testUser.id });

    const addRes = await request(app.getHttpServer())
      .post('/webtoon/naver_1/bookmark')
      .set('Authorization', `Bearer ${token}`)
      .expect(201);

    expect(addRes.body).toMatchObject({
      statusCode: 201,
      message: 'success',
      data: { isBookmarked: true },
    });
    expect(bookmarkRepo.rows).toHaveLength(1);

    const removeRes = await request(app.getHttpServer())
      .post('/webtoon/naver_1/bookmark')
      .set('Authorization', `Bearer ${token}`)
      .expect(201);

    expect(removeRes.body.data).toMatchObject({ isBookmarked: false });
    expect(bookmarkRepo.rows).toHaveLength(0);
  });
});
