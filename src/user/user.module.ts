// src/user/user.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entity/user.entity';
import { UserController } from './user.controller'; // 🚀 방금 만든 창구 가져오기

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [UserController], // 🚀 메인 두꺼비집에 컨트롤러 등록!
  exports: [TypeOrmModule],
})
export class UserModule {}
