// src/auth/dto/signup.dto.ts
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class SignupDto {
  // 1. 이메일 형식인지, 비어있지 않은지 검사
  @IsEmail({}, { message: '올바른 이메일 형식을 입력해주세요.' })
  @IsNotEmpty({ message: '이메일은 필수 입력값입니다.' })
  email!: string;

  // 2. 문자열인지, 비어있지 않은지, 최소 6자리 이상인지 검사
  @IsString()
  @IsNotEmpty({ message: '비밀번호는 필수 입력값입니다.' })
  @MinLength(6, { message: '비밀번호는 최소 6자 이상이어야 합니다.' })
  password!: string;

  // 3. 문자열인지, 비어있지 않은지 검사
  @IsString()
  @IsNotEmpty({ message: '닉네임은 필수 입력값입니다.' })
  nickname!: string;
}
