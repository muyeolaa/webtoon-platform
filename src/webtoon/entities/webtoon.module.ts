import { Module } from "@nestjs/common";
import { KakaoCrawlerService } from "./kakao.service";
import { NaverCrawlerService } from "./naver.service";
import { HttpModule } from "@nestjs/axios";
import { WebtoonController } from "./webtoons.controller";

@Module({
    imports: [
    HttpModule // 2. 여기에 추가! (NaverCrawlerService가 HttpService를 쓸 수 있게 해줍니다)
  ],
  controllers: [WebtoonController],
  providers: [    
    NaverCrawlerService, 
    KakaoCrawlerService
  ],
  exports: [
    NaverCrawlerService, 
    KakaoCrawlerService
  ]
})
export class WebtoonModule {}