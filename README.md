# memberp
공동체IT 조합원들이 참여하는 ERP

## 문서

- 설계 배경 문서: `docs/planning/`
- 기술 스택·인증·이메일 발송 결정(ADR): `docs/decisions/`
- R1 데이터 스키마 설계: `docs/design/r1-schema.md`
- Next.js 프로젝트 구조·인증 흐름: `docs/design/project-structure.md`

## 개발 환경

```bash
npm install
cp .env.example .env        # DATABASE_URL, APP_BASE_URL, TOTP_ENCRYPTION_KEY 등을 채운다
                             # TOTP_ENCRYPTION_KEY 생성: openssl rand -base64 32
npx prisma migrate dev
npx tsx prisma/bootstrap-admin.ts you@example.org   # 최초 관리자 초대
npm run dev
```

`RESEND_API_KEY`를 비워두면 실제 이메일 발송 없이 콘솔에 로그인·초대 링크가 출력된다
(로컬 개발용). 스키마 정의는 `prisma/schema.prisma`에 있다.
