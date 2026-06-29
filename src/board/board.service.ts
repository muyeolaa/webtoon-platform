// src/board/board.service.ts
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
      return await this.boardRepository.find({
        where: { category: 'NOTICE' },
        order: { createdAt: 'DESC' },
        relations: ['author'],
        select: {
          author: { id: true, nickname: true },
        },
      });
    }

    if (category === 'BUG') {
      // 🚀 이전 단계 수정 반영: 다른 사람의 버그 글도 리스트에는 보이도록 필터 제거
      return await this.boardRepository.find({
        where: { category: 'BUG' },
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

    // 🚀 수정: 비밀글인데 작성자도 아니고, 동시에 관리자(ADMIN)도 아니면 차단!
    if (
      post.isSecret &&
      (!user || (user.id !== post.author.id && user.role !== 'ADMIN'))
    ) {
      throw new ForbiddenException('비밀글은 작성자만 볼 수 있습니다.');
    }

    return post;
  }
  async updatePost(id: number, user: any, title: string, content: string) {
    const post = await this.boardRepository.findOne({
      where: { id },
      relations: ['author'],
    });

    if (!post) throw new NotFoundException('게시글을 찾을 수 없습니다.');

    // 🚀 수정은 무조건 작성자 본인만 가능! (관리자도 내용 수정은 불가)
    if (post.author.id !== user.id) {
      throw new ForbiddenException('게시글 수정 권한이 없습니다.');
    }

    post.title = title;
    post.content = content;
    return await this.boardRepository.save(post);
  }

  // 5. 게시글 삭제 (작성자 OR 관리자)
  async deletePost(id: number, user: any) {
    const post = await this.boardRepository.findOne({
      where: { id },
      relations: ['author'],
    });

    if (!post) throw new NotFoundException('게시글을 찾을 수 없습니다.');

    // 🚀 삭제 권한 체크: 작성자 본인도 아니고, 관리자도 아니면 차단!
    if (post.author.id !== user.id && user.role !== 'ADMIN') {
      throw new ForbiddenException('게시글 삭제 권한이 없습니다.');
    }

    await this.boardRepository.remove(post);
    return { message: '게시글이 성공적으로 삭제되었습니다.' };
  }
}
