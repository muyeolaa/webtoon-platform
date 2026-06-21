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

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = this.userRepository.create({
      email,
      nickname,
      password: hashedPassword,
    });

    await this.userRepository.save(newUser);

    const { password: _, ...result } = newUser;
    return {
      message: '회원가입이 완료되었습니다!',
      user: result,
    };
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) {
      throw new UnauthorizedException('이메일 또는 비밀번호가 틀렸습니다.');
    }

    if (user.provider !== 'local' || !user.password) {
      throw new UnauthorizedException(
        `이 계정은 ${user.provider}로 가입되었습니다. 소셜 로그인을 이용해 주세요.`,
      );
    }

    const isPasswordMatched = await bcrypt.compare(password, user.password);
    if (!isPasswordMatched) {
      throw new UnauthorizedException('이메일 또는 비밀번호가 틀렸습니다.');
    }

    const payload = { email: user.email, sub: user.id };

    return {
      message: '로그인 성공!',
      accessToken: this.jwtService.sign(payload),
      // 🚀 프론트엔드에 전달하는 정보에 role 추가!
      user: {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        role: user.role, // 💡 드디어 계급장 발급!
      },
    };
  }
}
