# 프로젝트 구조 (Next.js)

ADR-0001에서 결정한 대로 Next.js(App Router) + TypeScript 단일 모놀리스로 구성한다.

## 디렉터리

```
src/
  app/                  라우트(화면). 폴더 = URL 경로
    layout.tsx          루트 레이아웃 — 모바일 뷰포트, 바텀 내비게이션
    globals.css
    page.tsx            내 홈
    activities/
      page.tsx           활동 목록 (FR-04) — Prisma 연동 예시
      [activityId]/page.tsx  활동 상세 (FR-04/05)
    my/
      participation/page.tsx  내 참여 (FR-05)
      contributions/page.tsx  내 기여 (FR-07)
      contributions/new/page.tsx  기여 작성 = "기록하기" (FR-06)
      profile/page.tsx   내 정보 (FR-03)
    needs/page.tsx       상담·수요 = "우리 조합" (FR-08)
    review/page.tsx      담당자 확인함 (FR-07)
    admin/page.tsx        관리자 설정 (FR-01, FR-11)
    api/health/route.ts  헬스체크 (DB 연결 확인)
  components/
    BottomNav.tsx        모바일 기본 메뉴 (v0.2 §2.1): 홈/참여할 일/기록하기/우리 조합/내 정보
    ScreenPlaceholder.tsx  아직 구현되지 않은 화면의 공통 자리표시자
  lib/
    prisma.ts            PrismaClient 싱글턴
prisma/
  schema.prisma          R1 데이터 모델 (별도 설계 문서: docs/design/r1-schema.md)
```

## 화면과 요구사항 번호의 연결

`src/app` 폴더 구조는 v1.0 §6(화면 구성)의 R1 화면과 §5(FR 번호)에 맞춰 배치했다.
아직 로직이 없는 화면은 `ScreenPlaceholder` 컴포넌트로 표시해, 어떤 화면이 "존재하지만
비어 있는지"와 "아직 라우트조차 없는지"를 구분할 수 있게 했다. `activities/`만 Prisma
연동을 실제로 붙여 스택 전체(Next.js → Prisma → PostgreSQL)가 동작하는지 확인하는
용도로 먼저 구현했다 — 나머지 화면의 실제 데이터 연동은 이후 작업이다.

## 아직 없는 것 (의도적으로 비워둠)

- **인증**: Auth.js 연동, 세션, 미들웨어 기반 권한 검사. 인증 방식(이메일/전화 OTP 등)이
  아직 조합의 결정 사항으로 남아 있어(v1.0 §14) 붙이지 않았다. `PermissionGrant` 모델은
  스키마에 이미 있으므로, 인증 방식이 정해지면 미들웨어에서 그 모델을 조회하면 된다.
- **폼 제출·서버 액션**: 기여 작성, 참여 신청 등 실제 쓰기 동작. 화면 골격만 있다.
- **파일 업로드(S3/MinIO 연동)**: ADR-0001에서 정한 오브젝트 스토리지 클라이언트는 아직
  코드로 옮기지 않았다.
- **알림 발송(BullMQ/Redis)**: 백그라운드 작업 큐는 아직 구성하지 않았다.
- **Docker Compose 배포 설정**: 로컬 검증은 이 컨테이너에 설치된 PostgreSQL로 직접 진행했다.

## 로컬 실행

```bash
npm install
cp .env.example .env       # DATABASE_URL을 로컬 PostgreSQL로 수정
npx prisma migrate dev
npm run dev                 # http://localhost:3000
```

## 검증 이력

- `npm run build` (Next.js 프로덕션 빌드) 통과
- `npm run lint` 통과
- `next start`로 띄운 뒤 `/api/health`, `/activities`(실제 DB 데이터 렌더링 확인),
  나머지 자리표시자 라우트가 모두 200을 반환하는지 확인
