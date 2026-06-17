// src/auth/auth.service.ts
import {
  Injectable,
  ConflictException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../user/entity/user.entity';
import { SignupDto } from './dto/signup.dto';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private jwtService: JwtService,
  ) {}

  async signup(signupDto: SignupDto) {
    const { email, password, nickname } = signupDto;

    // 1. 이미 존재하는 이메일인지 싹 뒤져보기 (아까 정했던 1번 룰!)
    const existingUser = await this.userRepository.findOne({
      where: { email },
    });
    if (existingUser) {
      if (existingUser.provider !== 'local') {
        throw new ConflictException(
          `해당 이메일은 이미 ${existingUser.provider} 계정으로 가입되어 있습니다.`,
        );
      }
      throw new ConflictException('이미 사용 중인 이메일입니다.');
    }
    if (!password) {
      throw new BadRequestException('일반 회원가입 시 비밀번호는 필수입니다.');
    }

    // 2. 비밀번호 암호화 (Salt Rounds: 10이 국룰)
    const hashedPassword = await bcrypt.hash(password, 10);

    // 3. 유저 데이터 조립 (일반 가입이므로 provider는 기본값 'local'로 들어감)
    const newUser = this.userRepository.create({
      email,
      nickname,
      password: hashedPassword,
    });

    // 4. DB에 저장
    await this.userRepository.save(newUser);

    // 5. 프론트엔드에 응답 (비밀번호는 빼고 주는 게 백엔드 매너!)
    const { password: _, ...result } = newUser;
    return {
      message: '회원가입이 완료되었습니다!',
      user: result,
    };
  }
  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    // 1. 유저가 보낸 이메일로 DB 뒤지기
    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) {
      throw new UnauthorizedException('이메일 또는 비밀번호가 틀렸습니다.'); // 보안상 둘 중 뭐가 틀렸는지 안 알려주는 게 국룰!
    }

    // 2. 소셜 가입자인데 로컬로 로그인 시도하는 경우 막기
    if (user.provider !== 'local' || !user.password) {
      throw new UnauthorizedException(
        `이 계정은 ${user.provider}로 가입되었습니다. 소셜 로그인을 이용해 주세요.`,
      );
    }

    // 3. 비밀번호 일치하는지 비교 (암호화된 문자열과 날것을 비교해 줌)
    const isPasswordMatched = await bcrypt.compare(password, user.password);
    if (!isPasswordMatched) {
      throw new UnauthorizedException('이메일 또는 비밀번호가 틀렸습니다.');
    }

    // 4. 비밀번호까지 통과! => JWT 출입증(토큰) 만들기
    const payload = { email: user.email, sub: user.id }; // 토큰 안에 담아둘 정보 (절대 비번 넣으면 안 됨!)

    return {
      message: '로그인 성공!',
      accessToken: this.jwtService.sign(payload),
      // 🚀 프론트엔드가 쓸 수 있게 유저 정보도 같이 던져주기!
      user: {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
      },
    };
  }
}
