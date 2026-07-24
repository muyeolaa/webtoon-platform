// src/webtoon/crawler/naver-crawler.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { of, throwError } from 'rxjs';
import { getRepositoryToken } from '@nestjs/typeorm';
import { HttpService } from '@nestjs/axios';
import { NaverCrawlerService } from './naver-crawler.service';
import { WebtoonService } from '../webtoon.service';
import { NaverEpisodeCrawlerService } from './naver-episode-crawler.service';
import { WebtoonAdapterFactory } from '../adapters/webtoon-adapter.factory';
import { NaverWebtoonAdapter } from '../adapters/naver-webtoon.adapter';
import { Webtoon } from '../entities/webtoon.entity';

describe('NaverCrawlerService', () => {
  let service: NaverCrawlerService;
  let httpService: { get: jest.Mock };
  let webtoonRepository: { upsert: jest.Mock };

  beforeEach(async () => {
    httpService = { get: jest.fn() };
    webtoonRepository = { upsert: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NaverCrawlerService,
        { provide: HttpService, useValue: httpService },
        { provide: getRepositoryToken(Webtoon), useValue: webtoonRepository },
        { provide: WebtoonService, useValue: {} },
        { provide: NaverEpisodeCrawlerService, useValue: {} },
        {
          provide: WebtoonAdapterFactory,
          useValue: { getAdapter: () => new NaverWebtoonAdapter() },
        },
      ],
    }).compile();

    service = module.get(NaverCrawlerService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('getNaverWebtoons', () => {
    it('중복된 titleId는 하나로 합치고 연재 요일을 병합한다', async () => {
      // 정규 요일(월요일) API 응답: titleId 1번이 연재
      httpService.get.mockReturnValueOnce(
        of({
          data: {
            titleListMap: {
              MONDAY: [
                {
                  titleId: 1,
                  titleName: '테스트 웹툰',
                  author: '홍길동',
                  thumbnailUrl: 'https://example.com/thumb.png',
                  adult: false,
                  up: false,
                  rest: false,
                  bm: false,
                  starScore: 9.1,
                },
              ],
            },
          },
        }),
      );

      // 매일+ API 응답: 같은 titleId 1번이 매일+에도 중복 연재
      httpService.get.mockReturnValueOnce(
        of({
          data: {
            titleList: [
              {
                titleId: 1,
                titleName: '테스트 웹툰',
                author: '홍길동',
                thumbnailUrl: 'https://example.com/thumb.png',
                adult: false,
                up: false,
                rest: false,
                bm: false,
                starScore: 9.1,
              },
            ],
          },
        }),
      );

      const result = await service.getNaverWebtoons();

      expect(result.count).toBe(1);
      expect(webtoonRepository.upsert).toHaveBeenCalledTimes(1);

      const [savedChunk] = webtoonRepository.upsert.mock.calls[0];
      expect(savedChunk).toHaveLength(1);
      expect(savedChunk[0]).toMatchObject({
        id: 'naver_1',
        platform: 'naver',
      });
      expect(savedChunk[0].publishDays).toEqual(
        expect.arrayContaining(['MONDAY', 'DAILY_PLUS']),
      );
    });

    it('매일+ API 호출이 실패해도 정규 요일 데이터는 정상 저장된다', async () => {
      // 정규 요일 API는 정상 응답
      httpService.get.mockReturnValueOnce(
        of({
          data: {
            titleListMap: {
              MONDAY: [
                {
                  titleId: 2,
                  titleName: '방어로직 테스트',
                  author: '작가',
                  thumbnailUrl: 'https://example.com/thumb2.png',
                  adult: false,
                  up: false,
                  rest: false,
                  bm: false,
                  starScore: 8.5,
                },
              ],
            },
          },
        }),
      );

      // 매일+ API는 네트워크 에러 -> 서비스 내부에서 빈 배열로 방어해야 함
      httpService.get.mockReturnValueOnce(
        throwError(() => new Error('network down')),
      );

      const result = await service.getNaverWebtoons();

      expect(result.count).toBe(1);
      const [savedChunk] = webtoonRepository.upsert.mock.calls[0];
      expect(savedChunk[0].id).toBe('naver_2');
    });
  });
});
