import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, ArrayContains } from 'typeorm'; // 🚀 IsNull, ArrayContains 추가!
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { Episode } from '../entities/episode.entity';
import { Webtoon } from '../entities/webtoon.entity'; // 🚀 Webtoon 엔티티 추가!
import { WebtoonService } from '../webtoon.service';

@Injectable()
export class LezhinEpisodeCrawlerService {
  private readonly logger = new Logger(LezhinEpisodeCrawlerService.name);

  constructor(
    @InjectRepository(Episode)
    private readonly episodeRepository: Repository<Episode>,

    // 🚀 웹툰 목록을 조회하기 위해 Webtoon 레포지토리 주입 추가!
    @InjectRepository(Webtoon)
    private readonly webtoonRepository: Repository<Webtoon>,

    private readonly httpService: HttpService,
    private readonly webtoonService: WebtoonService, // 🚀 줄거리, 장르 업데이트용 마스터 서비스
  ) {}

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

    if (process.env.LEZHIN_TOKEN)
      headers['Authorization'] = process.env.LEZHIN_TOKEN;
    if (process.env.LEZHIN_COOKIE)
      headers['Cookie'] = process.env.LEZHIN_COOKIE;

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

      // 🎯 1. 웹툰 상세 정보(줄거리, 통합 해시태그) 추출
      const description = content.display?.synopsis || '';

      // 🚀 네이버 방식 적용: 레진의 genres와 tags를 하나의 배열로 합치고 중복 제거!
      const rawGenres = content.genres || [];
      const rawTags = content.properties?.tags || [];
      const combinedGenres = Array.from(new Set([...rawGenres, ...rawTags]));
      const isAdultCheck =
        content.isAdult === true ||
        content.rating === 19 ||
        content.rating === '19';

      let lastEpisodeUpdatedAt: Date | null = null;
      if (episodes && episodes.length > 0) {
        // 레진도 보통 첫 번째(index 0)가 가장 최신 회차야
        const latestEp = episodes[0];
        if (latestEp.publishedAt) {
          lastEpisodeUpdatedAt = new Date(latestEp.publishedAt);
        }
      }

      // 합쳐진 해시태그 배열을 기존 업데이트 함수로 그대로 넘겨줌
      await this.webtoonService.updateWebtoonDetails(
        `lezhin_${content.id}`,
        description,
        combinedGenres,
        isAdultCheck, // 👈 5번째 자리로 밀려난 성인 여부(boolean)!
      );
      this.logger.log(
        `📝 [레진코믹스 ${alias}] 상세 정보(줄거리/통합해시태그) 업데이트 완료!`,
      );

      // 🎯 2. 회차(Episode) 데이터 조립 및 저장
      if (episodes.length === 0) return true;

      const episodesToSave = episodes.map((ep: any) => {
        const deepLinkUrl = `https://www.lezhin.com/ko/comic/${alias}/${ep.name}`;
        // 🚀 아까 우리가 완성한 썸네일 공식!
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
      // 🚀 상세 API 호출 시 토큰 만료 에러 방어막
      if (error.response?.status === 401) {
        this.logger.error(
          `🚨 [레진코믹스 ${alias}] 상세 수집 실패: 토큰이 만료되었습니다. .env를 확인하세요.`,
        );
      } else {
        this.logger.error(
          `❌ [레진코믹스 ${alias}] 수집 중 통신 에러: ${error.message}`,
        );
      }
      return false; // 서버 중단 없이 안전하게 종료
    }
  }

  // =========================================================================
  // 🚀 레진코믹스 전체 웹툰 상세/회차 수집 자동화 로직 (최초 1회 데이터 적재용)
  // =========================================================================
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

      await delay(1000); // 🛡️ IP 차단 방지 방어막
    }

    this.logger.log(
      `🎉 레진코믹스 전체 수집 완료! (성공: ${successCount} / 전체: ${targetWebtoons.length})`,
    );
    return { targetCount: targetWebtoons.length, successCount };
  }

  // =========================================================================
  // 🚀 레진코믹스 스마트 타겟팅 상세/회차 수집기 (매일 돌아가는 스케줄러용)
  // =========================================================================
  async syncSmartLezhinEpisodes() {
    this.logger.log('🧠 [레진코믹스] 스마트 타겟팅 수집을 시작합니다...');

    // 1. 오늘 요일을 영어 대문자로 구하기 (예: 'WEDNESDAY')
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

    // 🎯 타겟 A: 소개글이 없는 신작이나 누락된 웹툰
    const missingWebtoons = await this.webtoonRepository.find({
      where: { platform: 'lezhin', description: IsNull() },
    });

    // 🎯 타겟 B: 오늘 연재하는 웹툰 (최신화 업데이트 용도)
    const todayWebtoons = await this.webtoonRepository.find({
      where: { platform: 'lezhin', publishDays: ArrayContains([todayEnglish]) },
    });

    // 💡 두 부대를 합치고 중복 제거 (신작인데 오늘 연재작일 수도 있으니까!)
    const targetMap = new Map();
    [...missingWebtoons, ...todayWebtoons].forEach((webtoon) => {
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

    // 🚀 타겟팅된 웹툰들만 핀셋으로 집어서 상세/회차 수집 돌리기!
    for (const webtoon of finalTargets) {
      if (!webtoon.alias) continue;

      const success = await this.seedLezhinEpisodes(webtoon.alias);

      if (success) {
        successCount++;

        // 🚨 [핵심 방어막] 타겟 A(단순 정보 보강)로 불려온 옛날 완결작이 '최신'으로 둔갑하는 것을 방지!
        // 이 웹툰의 연재 요일에 '오늘(todayEnglish)'이 포함되어 있을 때만 연재일을 갱신합니다.
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
