// src/common/entities/config.entity.ts
import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('app_configs')
export class AppConfig {
  @PrimaryColumn()
  variablename!: string; // 예: 'adult_token'

  @Column('text')
  value!: string; // 실제 토큰 값
}
