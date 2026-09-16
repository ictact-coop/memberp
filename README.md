# memberp
공동체IT 조합원들이 참여하는 ERP

## 문서

- 설계 배경 문서: `docs/planning/`
- 기술 스택 결정(ADR): `docs/decisions/`
- R1 데이터 스키마 설계: `docs/design/r1-schema.md`

## 개발 환경

```bash
npm install
cp .env.example .env   # DATABASE_URL을 로컬 PostgreSQL로 수정
npx prisma migrate dev
npx prisma generate
```

스키마 정의는 `prisma/schema.prisma`에 있다.
