import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, ArrayContains } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { Episode } from '../entities/episode.entity';
import { Webtoon } from '../entities/webtoon.entity';
import { WebtoonService } from '../webtoon.service';
import { AppConfig } from '../entities/config.entity';

@Injectable()
export class LezhinEpisodeCrawlerService {
  private readonly logger = new Logger(LezhinEpisodeCrawlerService.name);

  constructor(
    @InjectRepository(Episode)
    private readonly episodeRepository: Repository<Episode>,
    @InjectRepository(Webtoon)
    private readonly webtoonRepository: Repository<Webtoon>,
    @InjectRepository(AppConfig)
    private readonly configRepository: Repository<AppConfig>,
    private readonly httpService: HttpService,
    private readonly webtoonService: WebtoonService,
  ) {}

  // =========================================================================
  // 🔒 [NEW] DB에서 레진 토큰 및 쿠키 실시간 통합 조회 헬퍼 함수
  // =========================================================================
  private async getLezhinAuthCredentials(): Promise<{
    token: string | null;
    cookie: string | null;
  }> {
    try {
      const [tokenConfig, cookieConfig] = await Promise.all([
        this.configRepository.findOne({
          where: { variablename: 'LEZHIN_TOKEN' },
        }),
        this.configRepository.findOne({
          where: { variablename: 'LEZHIN_COOKIE' },
        }),
      ]);

      return {
        token: tokenConfig ? tokenConfig.value : null,
        cookie: cookieConfig ? cookieConfig.value : null,
      };
    } catch (error) {
      this.logger.error(
        `❌ DB에서 레진 인증 정보를 불러오는 중 에러 발생: ${(error as Error).message}`,
      );
      return { token: null, cookie: null };
    }
  }

  // =========================================================================
  // 🚀 레진 단일 웹툰 상세 정보(줄거리, 통합 해시태그) & 회차 수집기
  // =========================================================================
  async seedLezhinEpisodes(alias: string) {
    this.logger.log(`🔍 [레진코믹스 ${alias}] 상세 및 회차 수집 시작...`);

    const url = `https://www.lezhin.com/lz-api/v2/contents/${alias}/info?type=comic`;

    const headers: any = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      'x-lz-allowadult': 'true',
      'x-lz-adult': '2',
      'x-lz-country': 'kr',
    };

    // 🚀 [수정] 환경변수 대신 DB에서 인증 및 쿠키 토큰을 실시간으로 취득
    const { token, cookie } = await this.getLezhinAuthCredentials();

    if (token) headers['Authorization'] = token;
    if (cookie) headers['Cookie'] = cookie;

    try {
      const { data } = await firstValueFrom(
        this.httpService.get(url, { headers }),
      );

      const content = data?.data?.content;
      const episodes = data?.data?.episodes || [];

      if (!content) {
        this.logger.error(
          `❌ [레진코믹스 ${alias}] 상세 데이터를 불러오지 못했습니다.`,
        );
        return false;
      }

      const description = content.display?.synopsis || '';
      const rawGenres = content.genres || [];
      const rawTags = content.properties?.tags || [];
      const combinedGenres = Array.from(new Set([...rawGenres, ...rawTags]));
      const isAdultCheck =
        content.isAdult === true ||
        content.rating === 19 ||
        content.rating === '19';

      let lastEpisodeUpdatedAt: Date | null = null;
      if (episodes && episodes.length > 0) {
        const latestEp = episodes[0];
        if (latestEp.publishedAt) {
          lastEpisodeUpdatedAt = new Date(latestEp.publishedAt);
        }
      }

      await this.webtoonService.updateWebtoonDetails(
        `lezhin_${content.id}`,
        description,
        combinedGenres,
        isAdultCheck,
      );
      this.logger.log(
        `📝 [레진코믹스 ${alias}] 상세 정보(줄거리/통합해시태그) 업데이트 완료!`,
      );

      if (episodes.length === 0) return true;

      const episodesToSave = episodes.map((ep: any) => {
        const deepLinkUrl = `https://www.lezhin.com/ko/comic/${alias}/${ep.name}`;
        const thumbnailUrl = `https://ccdn.lezhin.com/v2/comics/${content.id}/episodes/${ep.id}/images/cover.webp?updated=${ep.updatedAt}&width=164`;

        return {
          titleId: String(content.id),
          episodeNo: ep.seq,
          title: ep.display?.displayName || ep.display?.title || ep.name,
          thumbnailUrl: thumbnailUrl,
          uploadDate: new Date(ep.publishedAt).toISOString().split('T')[0],
          url: deepLinkUrl,
          webtoon: { id: `lezhin_${content.id}` },
        };
      });

      const uniqueEpisodes = episodesToSave.filter(
        (ep, index, self) =>
          index === self.findIndex((t) => t.episodeNo === ep.episodeNo),
      );

      await this.episodeRepository.upsert(uniqueEpisodes, {
        conflictPaths: ['titleId', 'episodeNo'],
      });

      this.logger.log(
        `🎉 [레진코믹스 ${alias}] 총 ${uniqueEpisodes.length}개의 회차 수집 완료!`,
      );
      return true;
    } catch (error: any) {
      if (error.response?.status === 401) {
        this.logger.error(
          `🚨 [레진코믹스 ${alias}] 상세 수집 실패: 토큰이 만료되었습니다. DB 설정을 확인하세요.`,
        );
      } else {
        this.logger.error(
          `❌ [레진코믹스 ${alias}] 수집 중 통신 에러: ${error.message}`,
        );
      }
      return false;
    }
  }

  async syncAllLezhinEpisodes() {
    const targetWebtoons = await this.webtoonRepository.find({
      where: { platform: 'lezhin' },
    });

    this.logger.log(
      `👀 총 ${targetWebtoons.length}개의 레진 웹툰 전체 상세/회차 수집을 시작합니다...`,
    );

    let successCount = 0;
    const delay = (ms: number) =>
      new Promise((resolve) => setTimeout(resolve, ms));

    for (const webtoon of targetWebtoons) {
      if (!webtoon.alias) {
        this.logger.warn(
          `⚠️ [${webtoon.id}] alias 값이 없어서 수집을 건너뜁니다.`,
        );
        continue;
      }

      const success = await this.seedLezhinEpisodes(webtoon.alias);
      if (success) successCount++;

      await delay(1000);
    }

    this.logger.log(
      `🎉 레진코믹스 전체 수집 완료! (성공: ${successCount} / 전체: ${targetWebtoons.length})`,
    );
    return { targetCount: targetWebtoons.length, successCount };
  }

  async syncSmartLezhinEpisodes() {
    this.logger.log('🧠 [레진코믹스] 스마트 타겟팅 수집을 시작합니다...');

    const days = [
      'SUNDAY',
      'MONDAY',
      'TUESDAY',
      'WEDNESDAY',
      'THURSDAY',
      'FRIDAY',
      'SATURDAY',
    ];
    const todayEnglish = days[new Date().getDay()];

    const missingWebtoons = await this.webtoonRepository.find({
      where: { platform: 'lezhin', description: IsNull() },
    });

    const todayWebtoons = await this.webtoonRepository.find({
      where: { platform: 'lezhin', publishDays: ArrayContains([todayEnglish]) },
    });

    const targetMap = new Map();
    [missingWebtoons, todayWebtoons].flat().forEach((webtoon) => {
      targetMap.set(webtoon.id, webtoon);
    });

    const finalTargets = Array.from(targetMap.values());

    this.logger.log(
      `👀 타겟팅 완료: 총 ${finalTargets.length}개의 웹툰(신작+오늘연재작)을 수집합니다.`,
    );

    if (finalTargets.length === 0)
      return { message: '수집할 타겟이 없습니다.' };

    let successCount = 0;
    const delay = (ms: number) =>
      new Promise((resolve) => setTimeout(resolve, ms));

    for (const webtoon of finalTargets) {
      if (!webtoon.alias) continue;

      const success = await this.seedLezhinEpisodes(webtoon.alias);

      if (success) {
        successCount++;

        if (webtoon.publishDays?.includes(todayEnglish)) {
          await this.webtoonRepository.update(webtoon.id, {
            lastEpisodeUpdatedAt: new Date(),
          });
        }
      }

      await delay(1000);
    }
    this.logger.log(
      `🎉 [레진코믹스] 스마트 수집 완료! (성공: ${successCount} / 타겟: ${finalTargets.length})`,
    );

    return { targetCount: finalTargets.length, successCount };
  }
}
