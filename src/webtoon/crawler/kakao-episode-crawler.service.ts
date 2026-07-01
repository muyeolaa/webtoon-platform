import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { InjectRepository } from '@nestjs/typeorm';
import { ArrayContains, IsNull, Repository } from 'typeorm';
import { Episode } from '../entities/episode.entity';
import { Webtoon } from '../entities/webtoon.entity';
import { WebtoonService } from '../webtoon.service';
import { AppConfig } from '../entities/config.entity'; // 🚀 1. AppConfig 추가

@Injectable()
export class KakaoEpisodeCrawlerService {
  private readonly logger = new Logger(KakaoEpisodeCrawlerService.name);

  constructor(
    private readonly httpService: HttpService,
    @InjectRepository(Episode)
    private readonly episodeRepository: Repository<Episode>,
    @InjectRepository(Webtoon)
    private readonly webtoonRepository: Repository<Webtoon>,
    @InjectRepository(AppConfig) // 🚀 2. DB 토큰 조회를 위한 레포지토리 주입
    private readonly configRepository: Repository<AppConfig>,
    private readonly webtoonService: WebtoonService,
  ) {}

  // =========================================================================
  // 🔒 [NEW] DB에서 카카오 인증 쿠키 가져오기 전용 헬퍼 함수
  // =========================================================================
  private async getKakaoAuthCookie(): Promise<string | null> {
    try {
      const config = await this.configRepository.findOne({
        where: { variablename: 'KAKAO_COOKIE' },
      });
      return config ? config.value : null;
    } catch (error) {
      this.logger.error(
        `❌ DB에서 카카오 쿠키를 불러오는 중 에러 발생: ${(error as Error).message}`,
      );
      return null;
    }
  }

  // =========================================================================
  // 카카오 단일 웹툰 회차 싹쓸이 (DB 쿠키 연동 완료)
  // =========================================================================
  async seedKakaoEpisodes(titleId: string, maxPages?: number) {
    this.logger.log(`🔍 [카카오 ${titleId}] 상세 정보 및 회차 수집 시작...`);

    let hasNext = true;
    let cursorIndex = 0;
    let isFirstPage = true;
    let totalSaved = 0;
    let currentPage = 1;

    const headers: any = {
      Referer: 'https://page.kakao.com/',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    };

    // 🚀 [수정] 환경변수 대신 DB에서 실시간 카카오 쿠키를 가져옵니다.
    const kakaoCookie = await this.getKakaoAuthCookie();
    if (kakaoCookie) {
      headers['Cookie'] = kakaoCookie;
    }

    try {
      while (hasNext) {
        const url = `https://bff-page.kakao.com/api/gateway/api/v2/content/product/list?series_id=${titleId}&cursor_index=${cursorIndex}&cursor_direction=NEXT&window_size=25&sort_type=asc`;

        const { data } = await firstValueFrom(
          this.httpService.get(url, { headers }),
        );

        const result = data?.result;
        if (!result) break;

        if (isFirstPage && result.series_item) {
          const series = result.series_item;
          const description = series.description || '';
          const genres = series.sub_category ? [series.sub_category] : [];

          await this.webtoonService.updateWebtoonDetails(
            `kakao_${titleId}`,
            description,
            genres,
          );

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

        const episodeList = result.list || [];
        if (episodeList.length === 0) break;

        const episodesToSave = episodeList.map((epObj: any) => {
          const item = epObj.item;
          const epThumbnail = item.thumbnail
            ? `https://dn-img-page.kakao.com/download/resource?kid=${item.thumbnail}&filename=th3`
            : '';

          return {
            titleId: titleId,
            episodeNo: item.order_value,
            title: item.title,
            thumbnailUrl: epThumbnail,
            uploadDate: item.last_release_dt.split('T')[0],
            url: `https://page.kakao.com/content/${titleId}/viewer/${item.product_id}`,
            webtoon: { id: `kakao_${titleId}` },
          };
        });

        const uniqueEpisodes = episodesToSave.filter(
          (ep, index, self) =>
            index === self.findIndex((t) => t.episodeNo === ep.episodeNo),
        );

        await this.episodeRepository.upsert(uniqueEpisodes, {
          conflictPaths: ['titleId', 'episodeNo'],
        });

        totalSaved += uniqueEpisodes.length;

        hasNext = result.has_next;
        if (hasNext) {
          cursorIndex = episodeList[episodeList.length - 1].cursor_index;
        }

        if (maxPages && currentPage >= maxPages) {
          this.logger.debug(
            `[UP 스나이퍼 모드] ${maxPages}페이지만 수집하고 멈춥니다.`,
          );
          break;
        }
        currentPage++;

        await new Promise((res) => setTimeout(res, 500));
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
  // 기관총 모드, 신작 추적 모드 등 이하 로직은 수정 없이 완벽하게 동작합니다.
  // =========================================================================
  async seedAllKakaoEpisodes(startIndex: number = 0) {
    this.logger.log(
      `🚀 [카카오 기관총] 전체 웹툰 수집을 시작합니다. (시작 인덱스: ${startIndex})`,
    );
    const kakaoWebtoons = await this.webtoonRepository.find({
      where: { platform: 'kakao' },
      select: ['id'],
      order: { id: 'ASC' },
    });

    const targetWebtoons = kakaoWebtoons.slice(startIndex);
    this.logger.log(
      `🎯 총 ${kakaoWebtoons.length}개 중, ${startIndex}번째부터 ${targetWebtoons.length}개의 웹툰 장전 완료!`,
    );

    let successCount = 0;
    for (let i = 0; i < targetWebtoons.length; i++) {
      const titleId = targetWebtoons[i].id.replace('kakao_', '');
      const currentIndex = startIndex + i;
      this.logger.log(
        `\n▶️ [카카오 수집 ${currentIndex + 1}/${kakaoWebtoons.length}] Title ID: ${titleId}`,
      );

      const isSuccess = await this.seedKakaoEpisodes(titleId);
      if (isSuccess) successCount++;

      await new Promise((res) => setTimeout(res, 1000));
    }

    this.logger.log(
      `✨ 카카오 수집 대장정 완료! (성공: ${successCount}/${targetWebtoons.length})`,
    );
  }

  async syncMissingDetails() {
    const targetWebtoons = await this.webtoonRepository.find({
      where: { platform: 'kakao', description: IsNull() },
      select: ['id'],
    });

    this.logger.log(
      `👀 총 ${targetWebtoons.length}개의 카카오 신작(빈칸) 상세 정보를 수집합니다.`,
    );
    if (targetWebtoons.length === 0) return { message: '빈칸이 없습니다.' };

    let successCount = 0;
    for (const webtoon of targetWebtoons) {
      const titleId = webtoon.id.replace('kakao_', '');
      const success = await this.seedKakaoEpisodes(titleId);
      if (success) successCount++;
      await new Promise((res) => setTimeout(res, 1000));
    }
    this.logger.log(`🎉 카카오 신작 빈칸 채우기 완료! (성공: ${successCount})`);
  }

  async syncUpdatedEpisodes() {
    this.logger.log(
      `🌟 [카카오] 'UP' 배지가 붙은 연재작들의 최신 회차 동기화를 시작합니다.`,
    );
    const upWebtoons = await this.webtoonRepository.find({
      where: { platform: 'kakao', up: true },
      select: ['id'],
    });

    if (upWebtoons.length === 0) {
      this.logger.log('💤 오늘 업데이트된 카카오 웹툰이 없습니다. 휴식합니다.');
      return { message: '오늘 업데이트된 웹툰이 없습니다.' };
    }

    this.logger.log(
      `🎯 총 ${upWebtoons.length}개의 업데이트된 웹툰 1페이지 수집 장전 완료!`,
    );

    let successCount = 0;
    for (const webtoon of upWebtoons) {
      const titleId = webtoon.id.replace('kakao_', '');
      const success = await this.seedKakaoEpisodes(titleId, 1);

      if (success) {
        successCount++;
        await this.webtoonRepository.update(webtoon.id, {
          lastEpisodeUpdatedAt: new Date(),
        });
      }
      await new Promise((res) => setTimeout(res, 1000));
    }

    this.logger.log(
      `✅ 카카오 일일 업데이트 수집 완료! (성공: ${successCount}/${upWebtoons.length})`,
    );
    return {
      message: '카카오 업데이트 회차 동기화 완료',
      targetCount: upWebtoons.length,
      successCount,
    };
  }
}
