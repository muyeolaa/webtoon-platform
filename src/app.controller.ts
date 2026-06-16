import { Controller, Get } from '@nestjs/common';
import { NaverCrawlerService } from './webtoon/crawler/naver-crawler.service';

@Controller()
export class AppController {
  constructor(private readonly appService: NaverCrawlerService) {}

  @Get('check')
  async check() {
    return await this.appService.getNaverWebtoons();
  }
}
