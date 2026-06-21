import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { BoardService } from './board.service';
// 💡 경로 확인 필수!
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('board')
export class BoardController {
  constructor(private readonly boardService: BoardService) {}

  // ==========================================
  // 📝 공통 글쓰기
  // ==========================================
  @UseGuards(JwtAuthGuard)
  @Post()
  async createPost(
    @Req() req: any,
    @Body('category') category: string, // 'NOTICE' 또는 'BUG'
    @Body('title') title: string,
    @Body('content') content: string,
  ) {
    return this.boardService.createPost(req.user, category, title, content);
  }

  // ==========================================
  // 📢 공지사항 구역 (로그인 안 해도 보임)
  // ==========================================
  @Get('notice')
  async getNotices() {
    return this.boardService.getPosts('NOTICE');
  }

  @Get('notice/:id')
  async getNoticeDetail(@Param('id') id: string) {
    return this.boardService.getPostDetail(Number(id));
  }

  // ==========================================
  // 🐛 버그 제보 구역 (로그인 필수 + 철통 보안)
  // ==========================================
  @UseGuards(JwtAuthGuard)
  @Get('bug')
  async getMyBugs(@Req() req: any) {
    return this.boardService.getPosts('BUG', req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Get('bug/:id')
  async getBugDetail(@Param('id') id: string, @Req() req: any) {
    // 토큰의 유저 정보(req.user)를 같이 넘겨서 내 글이 맞는지 검사함
    return this.boardService.getPostDetail(Number(id), req.user);
  }
}
