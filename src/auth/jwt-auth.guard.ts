// src/auth/jwt-auth.guard.ts
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
// 'jwt'라는 이름의 Strategy(우리가 방금 만든 요원)를 작동시키는 가드야!
export class JwtAuthGuard extends AuthGuard('jwt') {}
