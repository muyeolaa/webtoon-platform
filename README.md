# 툰누스 (toonnus) — 웹툰 통합 뷰어 백엔드

네이버 · 카카오페이지 · 레진코믹스에 흩어져 있는 웹툰을 한곳에서 검색·조회·북마크할 수 있도록,
비공식 API를 정규화해 자체 데이터베이스로 통합한 백엔드입니다.

- **Live**: https://toonnus.com
- **API**: https://api.toonnus.com
- **Frontend repo**: https://github.com/muyeolaa/webtoon-platform_front
- **포트폴리오 상세 (Notion)**: _여기에 Notion '웹에 게시' 공개 링크를 넣어주세요_

## 기술 스택

| 분류 | 스택 |
| --- | --- |
| Backend | NestJS, TypeScript |
| Database | PostgreSQL, TypeORM |
| Auth | JWT, Passport, OAuth2 (Kakao / Naver / Google) |
| Infra | Docker, Nginx, AWS EC2 |
| Test | Jest, Supertest, Artillery |

## 아키텍처 하이라이트

**이기종 데이터 정규화 — 어댑터 + 팩토리 패턴**
네이버/카카오/레진 각 플랫폼마다 응답 구조가 전부 다른 문제를, `WebtoonSourceAdapter` 공통 인터페이스와
플랫폼별 어댑터(`NaverWebtoonAdapter`, `KakaoWebtoonAdapter`, `LezhinWebtoonAdapter`) + `WebtoonAdapterFactory`로 분리했습니다.
새 플랫폼이 추가돼도 기존 크롤러/서비스 코드는 수정하지 않고 어댑터 하나만 추가하면 되는 구조입니다.

**API 응답 규격 통일**
모든 성공 응답을 `TransformInterceptor`로 `{ statusCode, message, data }` 형태로 통일하고,
예외 필터도 동일한 규격으로 응답하도록 맞춰 프론트엔드의 파싱/에러 처리를 단순화했습니다.

**쿼리 최적화**
- `(platform, isAdult)` 복합 인덱스로 목록 조회의 다중 필터 조합 성능 확보
- 북마크 수·별점을 `webtoon_table`에 반정규화하여 매 조회마다 발생하던 `COUNT`/`AVG` 집계 제거
- 웹툰 상세 조회는 `leftJoinAndSelect`로 명시적 조인 처리하여 N+1 방지

**인증**
Kakao/Naver/Google OAuth2 소셜 로그인 + 자체 JWT 발급. 로그인 여부에 따라 응답이 달라지는
API(성인물 노출 등)는 `OptionalAuthGuard`로 토큰 유효성만 확인하고 요청 자체는 막지 않도록 분리했습니다.

## 트러블슈팅: API 응답 규격을 바꿨더니 화면 네 곳이 조용히 멈췄다

응답 포맷을 `{ statusCode, message, data }`로 통일한 뒤 반영 전 점검 과정에서, 프론트엔드가 원래
알맹이 데이터를 바로 받는다고 가정하고 만들어져 있었던 탓에 홈 목록·상세·북마크·사이트맵까지
실제로 깨진 걸 발견했습니다. 특히 무한 스크롤은 에러 없이 다음 페이지를 조용히 안 불러오는 방식으로
망가져 있어 로그만으로는 찾을 수 없는 문제였습니다.

원인은 공통 fetch 함수 하나만 확인하고 넘어간 것으로, 실제로는 그 함수를 거치지 않고 백엔드를
직접 호출하는 코드가 따로 있었습니다. 백엔드를 호출하는 모든 지점을 전수 조사해 언랩 로직을 추가하고
실제 화면 동작까지 확인한 뒤 반영했습니다. API 계약을 바꿀 땐 엔드포인트 하나가 아니라 그 응답에
의존하는 모든 호출부를 역추적해야 한다는 것을 체감한 경험입니다.

## 실행 방법

```bash
# 설치
npm install

# 환경변수 (.env)
# DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD, DB_DATABASE
# JWT_SECRET
# KAKAO/NAVER/GOOGLE 소셜 로그인 클라이언트 키

# 개발 서버 실행
npm run start:dev

# 유닛 테스트
npm run test

# e2e 테스트
npm run test:e2e

# 부하 테스트 (서버가 떠 있는 상태에서)
npm run test:load
```

## 폴더 구조

```
src/
├── auth/            # JWT + OAuth2(Kakao/Naver/Google) 인증
├── board/            # 공지사항 / 버그 제보 게시판
├── common/           # 전역 인터셉터, 예외 필터
├── user/             # 유저
└── webtoon/
    ├── adapters/      # 플랫폼별 크롤러 어댑터 + 팩토리
    ├── crawler/       # 플랫폼별 크롤러, 스케줄러
    ├── bookmark/       # 북마크
    ├── rating/        # 별점
    ├── guards/        # OptionalAuthGuard
    └── entities/       # TypeORM 엔티티
```
