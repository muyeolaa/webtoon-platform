// src/webtoon/guards/optional-auth.guard.ts
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

// 로그인 여부에 따라 응답(성인물 노출 등)이 달라지는 API를 위한 '선택적' 인증 가드.
// 토큰이 없거나 유효하지 않아도 요청을 막지 않고, 유효할 때만 req.user를 채워준다.
@Injectable()
export class OptionalAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        request.user = this.jwtService.verify(token, {
          secret: this.configService.get<string>('JWT_SECRET'),
        });
      } catch {
        request.user = undefined;
      }
    }

    return true;
  }
}
