import { Module } from "@nestjs/common";
import { KakaoCrawlerService } from "./kakao.service";
import { NaverCrawlerService } from "./naver.service";
import { HttpModule } from "@nestjs/axios";
import { WebtoonController } from "./webtoon.controller";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Webtoon } from "./entities/webtoon.entity";
import { WebtoonService } from "./webtoon.service";

@Module({
    imports: [
    HttpModule,
    TypeOrmModule.forFeature([Webtoon]),
  ],
  controllers: [WebtoonController],
  providers: [    
    NaverCrawlerService, 
    KakaoCrawlerService,
    WebtoonService
  ],
  exports: [
    NaverCrawlerService, 
    KakaoCrawlerService
  ]
})
export class WebtoonModule {}