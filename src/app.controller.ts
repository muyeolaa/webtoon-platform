import { Controller, Get } from '@nestjs/common';
import { NaverCrawlerService } from './webtoon/naver.service';

@Controller()
export class AppController {
  constructor(private readonly appService: NaverCrawlerService) {}

  @Get('check')
  async check() {
    return await this.appService.getNaverWebtoons();
  }
}