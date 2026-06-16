// src/webtoon/bookemark/bookmark.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Bookmark } from '../entities/bookmark.entity';
import { Webtoon } from '../entities/webtoon.entity';
import { User } from '../../user/entity/user.entity';

@Injectable()
export class BookmarkService {
  constructor(
    @InjectRepository(Bookmark)
    private bookmarkRepository: Repository<Bookmark>,
    @InjectRepository(Webtoon)
    private webtoonRepository: Repository<Webtoon>,
  ) {}

  // 🚀 핵심 로직: 찜하기 & 찜 취소 토글
  async toggleBookmark(user: User, webtoonId: string) {
    // 1. 유저가 보내온 ID의 웹툰이 진짜로 존재하는지 확인
    const webtoon = await this.webtoonRepository.findOne({
      where: { id: webtoonId },
    });
    if (!webtoon) {
      throw new NotFoundException('존재하지 않는 웹툰입니다.');
    }

    // 2. 이 유저가 이 웹툰을 이미 찜했는지 DB에서 검색
    const existingBookmark = await this.bookmarkRepository.findOne({
      where: {
        user: { id: user.id },
        webtoon: { id: webtoonId },
      },
    });

    // 3. 이미 찜한 기록이 있다면? -> 찜 해제 (DB에서 삭제)
    if (existingBookmark) {
      await this.bookmarkRepository.remove(existingBookmark);
      return {
        message: '찜하기가 취소되었습니다.',
        isBookmarked: false,
      };
    }

    // 4. 찜한 기록이 없다면? -> 새로 찜하기 (DB에 생성)
    const newBookmark = this.bookmarkRepository.create({
      user,
      webtoon,
    });
    await this.bookmarkRepository.save(newBookmark);

    return {
      message: '웹툰을 찜했습니다!',
      isBookmarked: true,
    };
  }
}
