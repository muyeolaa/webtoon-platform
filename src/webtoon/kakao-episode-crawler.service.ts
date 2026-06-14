import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { InjectRepository } from '@nestjs/typeorm';
import { ArrayContains, IsNull, Repository } from 'typeorm';
import { Episode } from './entities/episode.entity';
import { Webtoon } from './entities/webtoon.entity';
import { WebtoonService } from './webtoon.service'; // 👈 import 추가

@Injectable()
export class KakaoEpisodeCrawlerService {
  private readonly logger = new Logger(KakaoEpisodeCrawlerService.name);

  constructor(
    private readonly httpService: HttpService,
    @InjectRepository(Episode)
    private readonly episodeRepository: Repository<Episode>,
    @InjectRepository(Webtoon)
    private readonly webtoonRepository: Repository<Webtoon>,
    private readonly webtoonService: WebtoonService, // 🚀 [NEW] 네이버처럼 서비스 주입!
  ) {}

  // =========================================================================
  // 카카오 단일 웹툰 회차 싹쓸이 (maxPages 파라미터 추가)
  // =========================================================================
  async seedKakaoEpisodes(titleId: string, maxPages?: number) {
    this.logger.log(`🔍 [카카오 ${titleId}] 상세 정보 및 회차 수집 시작...`);

    let hasNext = true;
    let cursorIndex = 0; // 카카오는 0부터 시작
    let isFirstPage = true;
    let totalSaved = 0;
    let currentPage = 1; // 🚀 현재 몇 번째 페이지를 긁는지 추적하기 위한 변수 추가!

    const headers: any = {
      Referer: 'https://page.kakao.com/',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    };

    if (process.env.KAKAO_COOKIE) {
      headers['Cookie'] = process.env.KAKAO_COOKIE;
    }

    try {
      while (hasNext) {
        const url = `https://bff-page.kakao.com/api/gateway/api/v2/content/product/list?series_id=${titleId}&cursor_index=${cursorIndex}&cursor_direction=NEXT&window_size=25&sort_type=asc`;

        const { data } = await firstValueFrom(
          this.httpService.get(url, { headers }),
        );

        const result = data?.result;
        if (!result) break;

        // 🎯 1. [첫 페이지만!] 웹툰 상세설명(줄거리) & 장르 & 찐 썸네일 업데이트
        if (isFirstPage && result.series_item) {
          const series = result.series_item;

          const description = series.description || '';

          // 카카오의 sub_category(예: '로맨스')를 배열로 만듭니다.
          const genres = series.sub_category ? [series.sub_category] : [];

          // 네이버랑 똑같이 WebtoonService의 마스터 함수를 호출해서 장르+설명 완벽하게 연결!
          await this.webtoonService.updateWebtoonDetails(
            `kakao_${titleId}`,
            description,
            genres,
          );

          // 찐 썸네일 업데이트는 기존처럼 Repository 사용
          const realThumbnail = series.thumbnail
            ? `https://dn-img-page.kakao.com/download/resource?kid=${series.thumbnail}&filename=th3`
            : undefined;

          if (realThumbnail) {
            await this.webtoonRepository.update(
              { id: `kakao_${titleId}` },
              { thumbnailUrl: realThumbnail },
            );
          }

          this.logger.log(
            `📝 [카카오 ${titleId}] 웹툰 상세설명, 장르, 썸네일 업데이트 완료!`,
          );
          isFirstPage = false;
        }

        // 🎯 2. 회차 데이터 추출 및 조립
        const episodeList = result.list || [];
        if (episodeList.length === 0) break;

        const episodesToSave = episodeList.map((epObj: any) => {
          const item = epObj.item;

          const epThumbnail = item.thumbnail
            ? `https://dn-img-page.kakao.com/download/resource?kid=${item.thumbnail}&filename=th3`
            : '';

          return {
            titleId: titleId,
            episodeNo: item.order_value, // 우리가 찾아낸 찐 회차 번호
            title: item.title,
            thumbnailUrl: epThumbnail,
            uploadDate: item.last_release_dt.split('T')[0],

            // 다이렉트 주소 저장 (엔티티에 url 컬럼 추가 필수!)
            url: `https://page.kakao.com/content/${titleId}/viewer/${item.product_id}`,

            // TypeORM 관계 연결 (웹툰 테이블의 PK와 매핑)
            webtoon: { id: `kakao_${titleId}` },
          };
        });

        // 🚀 3. 배열 내에서 episodeNo가 겹치는 쌍둥이 데이터 제거 (최신 데이터 1개만 유지)
        const uniqueEpisodes = episodesToSave.filter(
          (ep, index, self) =>
            index === self.findIndex((t) => t.episodeNo === ep.episodeNo),
        );

        // 📦 4. 중복이 제거된 깔끔한 배열을 DB에 저장! (ConflictPaths 명시)
        await this.episodeRepository.upsert(uniqueEpisodes, {
          conflictPaths: ['titleId', 'episodeNo'],
        });

        totalSaved += uniqueEpisodes.length;

        // 🚩 5. 다음 페이지를 위한 커서(Cursor) 업데이트!
        hasNext = result.has_next;
        if (hasNext) {
          cursorIndex = episodeList[episodeList.length - 1].cursor_index;
        }

        // 🚀 [추가된 핵심 로직] maxPages가 설정되어 있고, 현재 페이지가 그 값에 도달했다면 바로 루프 탈출!
        if (maxPages && currentPage >= maxPages) {
          this.logger.debug(
            `[UP 스나이퍼 모드] ${maxPages}페이지만 수집하고 멈춥니다.`,
          );
          break;
        }
        currentPage++; // 다음 페이지로 카운트 증가

        await new Promise((res) => setTimeout(res, 500)); // 차단 방지 휴식
      }

      this.logger.log(
        `🎉 [카카오 ${titleId}] 총 ${totalSaved}개 회차 및 상세설명 수집 완료!`,
      );
      return true;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`❌ [카카오 ${titleId}] 수집 실패: ${errorMessage}`);
      return false;
    }
  }

  // =========================================================================
  // 🚀 카카오 전체 웹툰 회차 싹쓸이 (기관총 모드 - 이어하기 지원)
  // =========================================================================
  async seedAllKakaoEpisodes(startIndex: number = 0) {
    this.logger.log(
      `🚀 [카카오 기관총] 전체 웹툰 수집을 시작합니다. (시작 인덱스: ${startIndex})`,
    );

    // 1. DB에서 카카오 웹툰을 ID 순서대로 일정하게 가져옵니다.
    const kakaoWebtoons = await this.webtoonRepository.find({
      where: { platform: 'kakao' },
      select: ['id'],
      order: {
        id: 'ASC', // 🚀 항상 똑같은 순서가 보장되도록 ID 기준 오름차순 정렬
      },
    });

    // 2. 전달받은 startIndex부터 끝까지만 잘라냅니다. (이어하기 핵심!)
    const targetWebtoons = kakaoWebtoons.slice(startIndex);

    this.logger.log(
      `🎯 총 ${kakaoWebtoons.length}개 중, ${startIndex}번째부터 ${targetWebtoons.length}개의 웹툰 장전 완료!`,
    );

    let successCount = 0;

    // 3. 잘라낸 타겟 웹툰들만 반복문을 돌립니다.
    for (let i = 0; i < targetWebtoons.length; i++) {
      const titleId = targetWebtoons[i].id.replace('kakao_', '');

      // 💡 현재 진짜 번호(전체 기준 인덱스)를 로그에 찍어줍니다.
      const currentIndex = startIndex + i;
      this.logger.log(
        `\n▶️ [카카오 수집 ${currentIndex + 1}/${kakaoWebtoons.length}] Title ID: ${titleId}`,
      );

      const isSuccess = await this.seedKakaoEpisodes(titleId);
      if (isSuccess) successCount++;

      // 카카오 차단 방지용 1초 휴식
      await new Promise((res) => setTimeout(res, 1000));
    }

    this.logger.log(
      `✨ 카카오 수집 대장정 완료! (성공: ${successCount}/${targetWebtoons.length})`,
    );
  }

  // =========================================================================
  // 🚀 [스케줄러용 1] 신작 추적: 상세설명이 없는(IsNull) 카카오 웹툰만 골라 수집
  // =========================================================================
  async syncMissingDetails() {
    const targetWebtoons = await this.webtoonRepository.find({
      where: {
        platform: 'kakao',
        description: IsNull(), // 💡 핵심: 소개글이 비어있는 녀석만 타겟팅!
      },
      select: ['id'],
    });

    this.logger.log(
      `👀 총 ${targetWebtoons.length}개의 카카오 신작(빈칸) 상세 정보를 수집합니다.`,
    );

    if (targetWebtoons.length === 0) return { message: '빈칸이 없습니다.' };

    let successCount = 0;
    for (const webtoon of targetWebtoons) {
      const titleId = webtoon.id.replace('kakao_', '');

      // 🚀 우리가 잘 만들어둔 단일 수집기 호출 (상세정보 + 회차 싹쓸이)
      const success = await this.seedKakaoEpisodes(titleId);
      if (success) successCount++;

      await new Promise((res) => setTimeout(res, 1000)); // 차단 방지
    }

    this.logger.log(`🎉 카카오 신작 빈칸 채우기 완료! (성공: ${successCount})`);
  }

  // =========================================================================
  // 🚀 [수정됨] 스케줄러용 데일리 업데이트: 'UP' 상태인 카카오 웹툰 최신화(1페이지) 수집
  // =========================================================================
  async syncUpdatedEpisodes() {
    this.logger.log(
      `🌟 [카카오] 'UP' 배지가 붙은 연재작들의 최신 회차 동기화를 시작합니다.`,
    );

    // 🚀 요일 필터링 대신, up 상태가 true인 작품들만 가져옵니다! (완결작 자동 스킵)
    const upWebtoons = await this.webtoonRepository.find({
      where: {
        platform: 'kakao',
        up: true,
      },
      select: ['id'],
    });

    if (upWebtoons.length === 0) {
      this.logger.log('💤 업데이트된 카카오 웹툰이 없습니다. 휴식합니다.');
      return;
    }

    this.logger.log(
      `🎯 총 ${upWebtoons.length}개의 업데이트된 웹툰 1페이지 수집 장전 완료!`,
    );

    let successCount = 0;
    for (const webtoon of upWebtoons) {
      const titleId = webtoon.id.replace('kakao_', '');

      // 🚀 핵심: seedKakaoEpisodes에 '1'을 넘겨서 1페이지만 아주 가볍게 긁어옵니다.
      const success = await this.seedKakaoEpisodes(titleId, 1);
      if (success) successCount++;

      await new Promise((res) => setTimeout(res, 1000));
    }

    this.logger.log(
      `✅ 카카오 일일 업데이트 수집 완료! (성공: ${successCount}/${upWebtoons.length})`,
    );
  }
}
