import { Module } from '@nestjs/common';
import { KakaoCrawlerService } from './crawler/kakao-crawler.service';
import { NaverCrawlerService } from './crawler/naver-crawler.service';
import { HttpModule } from '@nestjs/axios';
import { WebtoonController } from './webtoon.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Webtoon } from './entities/webtoon.entity';
import { WebtoonService } from './webtoon.service';
import { WebtoonSchedulerService } from './crawler/webtoon-scheduler.service';
import { NaverEpisodeCrawlerService } from './crawler/naver-episode-crawler.service';
import { Episode } from './entities/episode.entity';
import { Genre } from './entities/genre.entity';
import { KakaoEpisodeCrawlerService } from './crawler/kakao-episode-crawler.service';
import { LezhinCrawlerService } from './crawler/lezhin-crawler.service';
import { LezhinEpisodeCrawlerService } from './crawler/lezhin-episode-crawler.service';
import { BookmarkService } from './bookmark/bookmark.service';
import { RatingController } from './rating/rating.controller';
import { BookmarkController } from './bookmark/bookmark.controller';
import { RatingService } from './rating/rating.service';
import { Bookmark } from './entities/bookmark.entity';
import { Rating } from './entities/rating.entity';

@Module({
  imports: [
    HttpModule,
    TypeOrmModule.forFeature([Webtoon, Episode, Genre, Bookmark, Rating]),
  ],
  controllers: [WebtoonController, RatingController, BookmarkController],
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
    BookmarkService,
    RatingService,
  ],
  exports: [NaverCrawlerService, KakaoCrawlerService],
})
export class WebtoonModule {}
