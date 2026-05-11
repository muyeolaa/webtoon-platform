// src/webtoon/webtoon.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Webtoon } from './entities/webtoon.entity'; // 경로 확인!

@Injectable()
export class WebtoonService {
  constructor(
    // 매니저에게도 창고(DB) 문을 열 수 있는 마스터키(Repository)를 쥐어줍니다.
    @InjectRepository(Webtoon)
    private readonly webtoonRepository: Repository<Webtoon>,
  ) {}

  // 💡 핵심 기능: 창고에 있는 모든 웹툰 꺼내오기
  async findAllWebtoons() {
    // .find() 는 조건 없이 테이블의 모든 데이터를 배열로 가져오는 마법의 버튼입니다.
    const webtoons = await this.webtoonRepository.find();
    return webtoons;
  }
}