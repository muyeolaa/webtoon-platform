import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Board } from './entity/board.entity';

@Injectable()
export class BoardService {
  constructor(
    @InjectRepository(Board)
    private readonly boardRepository: Repository<Board>,
  ) {}

  // 1. 게시글 쓰기 (카테고리 자동 분류)
  async createPost(
    user: any,
    category: string,
    title: string,
    content: string,
  ) {
    // 🚀 핵심: 카테고리가 BUG면 무조건 비밀글(isSecret: true)로 강제 잠금!
    const isSecret = category === 'BUG';

    const newPost = this.boardRepository.create({
      category,
      title,
      content,
      isSecret,
      author: { id: user.id },
    });

    return await this.boardRepository.save(newPost);
  }

  // 2. 게시글 목록 보기
  async getPosts(category: string, user?: any) {
    if (category === 'NOTICE') {
      // 공지사항: 누구나 볼 수 있게 작성자 정보 포함해서 최신순 리턴
      return await this.boardRepository.find({
        where: { category: 'NOTICE' },
        order: { createdAt: 'DESC' },
        relations: ['author'],
        select: {
          author: { id: true, nickname: true }, // 비밀번호 등 민감정보 보호
        },
      });
    }

    if (category === 'BUG') {
      // 버그제보: 1:1 문의처럼 '내 글'만 모아서 리턴
      return await this.boardRepository.find({
        where: { category: 'BUG', author: { id: user.id } },
        order: { createdAt: 'DESC' },
        relations: ['author'],
        select: {
          author: { id: true, nickname: true },
        },
      });
    }
  }

  // 3. 게시글 상세 보기 (권한 체크)
  async getPostDetail(id: number, user?: any) {
    const post = await this.boardRepository.findOne({
      where: { id },
      relations: ['author'],
      select: {
        author: { id: true, nickname: true },
      },
    });

    if (!post) throw new NotFoundException('게시글을 찾을 수 없습니다.');

    // 🚀 비밀글 방어막: 게시물이 비밀글인데 내 글이 아니면 차단!
    if (post.isSecret && (!user || user.id !== post.author.id)) {
      throw new ForbiddenException('비밀글은 작성자만 볼 수 있습니다.');
    }

    return post;
  }
}
