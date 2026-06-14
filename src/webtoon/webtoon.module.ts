import { Module } from '@nestjs/common';
import { KakaoCrawlerService } from './kakao-crawler.service';
import { NaverCrawlerService } from './naver-crawler.service';
import { HttpModule } from '@nestjs/axios';
import { WebtoonController } from './webtoon.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Webtoon } from './entities/webtoon.entity';
import { WebtoonService } from './webtoon.service';
import { WebtoonSchedulerService } from './webtoon-scheduler.service';
import { NaverEpisodeCrawlerService } from './naver-episode-crawler.service';
import { Episode } from './entities/episode.entity';
import { Genre } from './entities/genre.entity';
import { KakaoEpisodeCrawlerService } from './kakao-episode-crawler.service';
import { LezhinCrawlerService } from './lezhin-crawler.service';
import { LezhinEpisodeCrawlerService } from './lezhin-episode-crawler.service';

@Module({
  imports: [HttpModule, TypeOrmModule.forFeature([Webtoon, Episode, Genre])],
  controllers: [WebtoonController],
  providers: [
    NaverCrawlerService,
    KakaoCrawlerService,
    WebtoonService,
    WebtoonSchedulerService,
    NaverEpisodeCrawlerService,
    KakaoEpisodeCrawlerService,
    LezhinCrawlerService,
    KakaoEpisodeCrawlerService,
    LezhinEpisodeCrawlerService,
  ],
  exports: [NaverCrawlerService, KakaoCrawlerService],
})
export class WebtoonModule {}
