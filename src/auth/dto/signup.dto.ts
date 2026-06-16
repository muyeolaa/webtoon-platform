// src/auth/dto/signup.dto.ts
export class SignupDto {
  email!: string;
  password?: string; // 소셜 로그인을 고려해 옵셔널로 설정 가능하지만, 로컬 가입엔 필수!
  nickname?: string;
}
