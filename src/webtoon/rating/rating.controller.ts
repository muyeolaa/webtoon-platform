// src/webtoon/rating.controller.ts
import {
  Controller,
  Post,
  Param,
  Body,
  UseGuards,
  Req,
  ParseFloatPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RatingService } from './rating.service';

@Controller('webtoon')
export class RatingController {
  constructor(private readonly ratingService: RatingService) {}

  @UseGuards(JwtAuthGuard)
  @Post(':id/rating')
  async rateWebtoon(
    @Req() req,
    @Param('id') webtoonId: string,
    // 💡 ParseFloatPipe: 프론트가 보낸 score를 안전하게 소수점 숫자(Float)로 자동 변환!
    @Body('score', ParseFloatPipe) score: number,
  ) {
    return this.ratingService.rateWebtoon(req.user, webtoonId, score);
  }
}
