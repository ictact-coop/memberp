# 프로젝트 구조 (Next.js)

ADR-0001에서 결정한 대로 Next.js(App Router) + TypeScript 단일 모놀리스로 구성한다.
인증(ADR-0002)·이메일 발송(ADR-0003)이 추가되며 `(protected)` 라우트 그룹이 생겼다.

## 디렉터리

```
src/
  app/
    layout.tsx            루트 레이아웃 — 모바일 뷰포트, 전역 CSS만 (내비게이션 없음)
    globals.css
    login/                비로그인 사용자용 — (protected) 밖에 있다
      page.tsx             이메일 입력 → 매직링크 요청
      check-email/page.tsx "메일을 확인하세요"
      totp/page.tsx         2단계 인증 코드(또는 복구코드) 입력
      totp/setup/page.tsx   TOTP 최초 등록(QR·비밀키·복구코드 발급)
    (protected)/          로그인(및 필요 시 TOTP)이 끝나야 들어오는 화면 — layout.tsx가 막는다
      layout.tsx            세션 확인 + 리다이렉트 + BottomNav
      page.tsx               내 홈
      activities/
        page.tsx              활동 목록 (FR-04) — Prisma 연동 예시
        [activityId]/page.tsx 활동 상세 (FR-04/05)
      my/
        participation/page.tsx  내 참여 (FR-05)
        contributions/page.tsx  내 기여 (FR-07) — 실제 목록, 이어 작성·정정 요청 링크
        contributions/new/page.tsx  기여 작성 = "기록하기" (FR-06) — 새로 작성/이어 작성/정정을 한 화면에서 처리
        profile/page.tsx   내 정보 (FR-03) — 로그인 이메일 표시·로그아웃 버튼은 실제 동작
      needs/page.tsx       상담·수요 = "우리 조합" (FR-08)
      review/page.tsx      담당자 확인함 (FR-07) — 실제 확인·보완요청 동작
      admin/
        page.tsx              관리자 설정 허브 — 하위 도구로 이동하는 링크 모음
        invitations/page.tsx  초대 관리(SECRETARIAT/SYSTEM_ADMIN 전용) — 발급·재발송·취소
        roles/page.tsx        역할 관리(SECRETARIAT/SYSTEM_ADMIN 전용) — 역할 부여·종료
      forbidden/page.tsx    로그인은 됐지만 역할·담당 범위가 안 맞을 때
    api/
      health/route.ts      헬스체크 (DB 연결 확인)
      auth/
        login/route.ts             POST: 매직링크 요청
        verify/route.ts            GET: 매직링크 소비 → 세션 발급
        logout/route.ts            POST: 세션 폐기
        accept-invitation/route.ts GET: 초대 수락 → 계정(+필요 시 주체) 생성 → 세션 발급
        totp/setup/route.ts        POST: TOTP 등록 확인·활성화
        totp/verify/route.ts       POST: TOTP 코드 또는 복구코드 확인
      contributions/
        save/route.ts               POST: 임시저장/제출 (BR-01, BR-06 멱등성)
        [id]/confirm/route.ts       POST: 담당자 확인 (BR-04/05 버전 대체 처리)
        [id]/request-revision/route.ts  POST: 보완 요청
      admin/
        roles/
          grant/route.ts             POST: 역할 부여
          [id]/revoke/route.ts       POST: 역할 종료(endDate 채움, 삭제 아님)
        invitations/
          create/route.ts            POST: 초대 발급 + 이메일 발송
          [id]/resend/route.ts       POST: 새 토큰 발급 후 재발송(같은 레코드 재사용)
          [id]/revoke/route.ts       POST: 초대 취소
  components/
    BottomNav.tsx        모바일 기본 메뉴 (v0.2 §2.1): 홈/참여할 일/기록하기/우리 조합/내 정보
    ScreenPlaceholder.tsx  아직 구현되지 않은 화면의 공통 자리표시자
  lib/
    prisma.ts            PrismaClient 싱글턴
    display-id.ts        ACT-0001 등 표시번호를 원자적으로 채번(DisplaySequence upsert)
    contribution-labels.ts  기여 유형·유무급·상태 enum의 한글 라벨(화면 3곳 이상 공유)
    role-labels.ts       PermissionRole·ScopeType enum의 한글 라벨
    auth/
      crypto.ts            토큰 생성·해시, TOTP 비밀키 암호화(AES-256-GCM), 복구코드 생성
      config.ts            토큰 TTL·세션 기간·TOTP 강제 대상 역할·getBaseUrl() 등
      session.ts           세션 생성·조회·폐기 (DB 기반, 계정 상태 실시간 확인)
      roles.ts             역할 조회(getActiveRoles/hasAnyRole), 페이지 가드(requireRole),
                            담당자 확인함 접근 판정(canAccessReviewInbox)
      login.ts             매직링크 요청·소비
      totp.ts              TOTP 등록·검증, 복구코드 소비
    email/
      resend.ts            ADR-0003: Resend 발송 래퍼(로그인·초대 공용). API 키 없으면
                            콘솔에 링크 출력
prisma/
  schema.prisma          R1 데이터 모델 (별도 설계 문서: docs/design/r1-schema.md)
  bootstrap-admin.ts     최초 관리자 초대장을 만드는 1회성 스크립트 — 이제 정식 화면
                         (/admin/invitations)이 있지만, 첫 관리자는 그 화면에 들어갈
                         계정 자체가 없어 여전히 스크립트로 부트스트랩해야 한다.
```

## 인증 흐름 (ADR-0002 구현)

```
[초대 수락]                    [로그인]
accept-invitation?token=…      login (이메일 입력)
   ↓ 계정 생성 + 세션 발급          ↓ POST /api/auth/login
   ↓                              check-email
   ├─ TOTP 불필요 → 홈             ↓ 메일의 링크 클릭
   └─ TOTP 필요 → totp/setup      GET /api/auth/verify?token=…
                                    ├─ TOTP 불필요 → 홈
                                    ├─ 미등록인데 필요 → totp/setup
                                    └─ 등록됨 → totp (코드 또는 복구코드)
```

- 세션은 `Session` 테이블에 저장되고, 쿠키에는 원문 대신 해시 대조용 랜덤 토큰만 있다.
- `(protected)/layout.tsx`가 매 요청마다 `getActiveSession()`으로 계정 상태·세션 만료·
  2단계 인증 완료 여부를 확인한다. 계정을 정지하면 그 다음 요청부터 바로 막힌다(FR-01).
- 인가(authorization)는 `src/lib/auth/roles.ts`에 있다 — 아래 "역할 기반 접근 제어" 참고.
- CSRF는 세션 쿠키의 `SameSite=Lax`에 기대고 있다 — 별도 CSRF 토큰은 아직 없다.
- 로그인 요청(`/api/auth/login`)에 속도 제한이 없다 — Redis 등 배경작업 인프라가
  아직 없어서다(ADR-0001). 대량 스팸 발송 위험은 남아 있는 과제로 남겨둔다.

## 기여 작성·확인 흐름 (FR-06/07 구현)

```
[조합원]                              [담당자]
/my/contributions/new                 /review
  ├ 임시저장(DRAFT) ──┐                  ├ 확인 → CONFIRMED
  │  (활동/필요 없어도 됨, BR-01)          │   (자기 자신의 기여는 거부: self_confirm)
  └ 제출(SUBMITTED) ──┼─────────────────┤
     (활동 또는 필요 필수)                 └ 보완 요청 → NEEDS_REVISION ──┐
                                                                        │
     ┌────────── 이어 작성(같은 submissionKey로 업데이트) ◄─────────────┘
     │
     └ 확인된 기여를 "정정 요청"하면 새 행(revisionOfId 연결)을 만들고,
       그 새 행이 확인되면 원본을 SUPERSEDED로 바꾼다(BR-03~05).
```

- **멱등성(BR-06/AT-04)**: 페이지를 새로 열 때마다 서버가 `submissionKey`를 새로 발급해
  숨은 필드에 넣는다. 같은 페이지에서 제출 버튼을 여러 번 눌러도 같은 키로 upsert되어
  한 건만 생긴다. 두 요청이 진짜로 동시에 도착해 둘 다 "아직 없음"으로 보고 생성을
  시도하는 경우에도, DB 유일 제약(P2002) 위반을 잡아 조용히 넘어가도록 처리했다 —
  실제로 3개 동시 요청을 보내 한 건만 생성됨을 확인했다(§검증 이력).
- **담당 범위(FR-07의 "담당 범위별 확인 대기 목록")**: "이 항목을 확인해도 되는가"는
  역할이 아니라 소유권(`Activity.managerAccountId`, `Need.assigneeAccountId`)으로 계속
  판단한다 — 역할이 있어도 남의 활동 제출물은 볼 수 없어야 하므로. 아래 "역할 기반
  접근 제어"가 추가한 것은 "이 화면 자체에 들어올 수 있는가"라는 한 단계 위의 문제다.
- **자가확인 제한(v1.0 §3)**: 확인(`/confirm`)은 작성자 본인이면 거부한다. 보완 요청은
  막지 않는다 — 스스로에게 더 해달라고 요청하는 것은 위험한 자가승인이 아니기 때문이다.
  "소규모 조직의 자가확인 예외"는 정책이 아직 없어(ADR-0001) 구현하지 않았다.
- **주체 연결**: 초대를 수락할 때 사무국이 미리 사람을 연결해두지 않았으면, 계정에 최소
  정보의 `Subject`(상태 `NEEDS_CONFIRMATION`)를 자동으로 만들어 연결한다 — 기여를
  남기려면 반드시 주체가 있어야 하기 때문이다(원본 구상인 "사무국이 나중에 확인 후
  연결"의 단순화 버전).

## 역할 기반 접근 제어 (`src/lib/auth/roles.ts`)

`PermissionGrant`(사람별 역할·기간)를 근거로 두 가지를 제공한다.

- `hasAnyRole(accountId, roles)` / `getActiveRoles(accountId)`: 시작·종료일이 지금 유효한
  부여만 센다 — 임기가 끝난 임원이 계속 권한을 갖지 않는다. 실제로 만료된 부여로는
  막히고, 유효한 부여로는 통과하는 것을 확인했다(§검증 이력).
- `requireRole(roles)`: Server Component에서 "이 역할이 없으면 못 들어온다"를 강제한다.
  실패하면 `/login`이 아니라 `/forbidden`으로 보낸다 — 이미 로그인은 되어 있으니
  "다시 로그인하라"는 안내는 틀린 안내이기 때문이다. 지금 `/admin`(SECRETARIAT,
  SYSTEM_ADMIN)에 적용했다.

`/review`는 순수 역할 게이트를 쓰지 않고 `canAccessReviewInbox`라는 별도 함수를 쓴다 —
역할이 있거나(ACTIVITY_MANAGER 등) **또는** 실제로 어떤 활동·수요의 담당자로 지정되어
있으면 통과한다. 활동을 만드는 화면이 아직 없어(FR-04 관리자 UI는 다음 작업), 지금은
활동 담당자 지정이 별도 역할 부여 없이 DB에 직접 이뤄질 수 있다 — 순수 역할 게이트를
썼다면 이런 "역할은 없지만 실제로 담당자로 지정된" 계정이 자기 활동의 제출물조차
확인할 수 없는 상황이 생겼을 것이다. 실제로 이 세 조합(역할 없음+담당 없음 → 차단,
역할 없음+담당 있음 → 통과, 담당 있어도 역할 없으면 `/admin`은 여전히 차단)을 모두
확인했다(§검증 이력).

### 역할 관리 화면 (`/admin/roles`)

`PermissionGrant`를 만들고 종료하는 화면이다. SECRETARIAT·SYSTEM_ADMIN만 들어올 수
있고, API(`/api/admin/roles/grant`, `/api/admin/roles/[id]/revoke`)도 화면과 별개로
같은 역할을 다시 확인한다 — 폼 렌더링을 거치지 않고 바로 POST가 올 수 있어서다.

- **범위 지정**: 역할을 전체(GLOBAL) 또는 특정 활동·기구(ACTIVITY/ORG_UNIT)로 좁힐 수
  있다. 활동·기구를 고르는 화면이 없어 ID를 직접 입력해야 한다 — 활동 목록·관리
  화면이 생기면 선택형으로 바꿀 대상이다. 범위를 특정으로 골랐는데 ID가 없으면 거부한다.
- **종료는 삭제가 아니다**: "종료" 버튼은 `endDate`를 오늘로 채운다. 누가 언제까지 그
  역할을 가지고 있었는지 이력이 남는다(v0.1 §2.1 "삭제 대신 보관").
- **자기 잠금 방지**: 자신의 마지막 SECRETARIAT/SYSTEM_ADMIN 부여를 스스로 종료하려
  하면 막는다 — 그렇지 않으면 소규모 조직에서 관리자가 한 명뿐일 때 실수로 자기 자신을
  관리 화면에서 내쫓는 상황이 생긴다.
- 계정 목록에는 이메일·연결된 주체 이름·상태와 현재 유효한 역할만 보여준다(만료된
  과거 부여는 이 화면에서 숨긴다 — 이력 조회는 아직 없음).

### 초대 관리 화면 (`/admin/invitations`)

지금까지 초대장은 `prisma/bootstrap-admin.ts` 스크립트로만 만들 수 있었다. 이제
SECRETARIAT·SYSTEM_ADMIN이 화면에서 이메일과(선택적으로) 역할을 입력해 초대를 보낼
수 있다. 역할을 함께 지정하면 그 역할이 가입과 동시에 `PermissionGrant`로 부여되고,
그 역할이 TOTP 대상(BOARD/FINANCE/SECRETARIAT/SYSTEM_ADMIN)이면 가입 직후 TOTP 등록이
강제된다 — 이 흐름은 이미 accept-invitation route에 있던 로직 그대로다.

- **중복 방지**: 이미 가입된 이메일은 거부하고("역할 관리에서 부여하라"고 안내), 이미
  PENDING 상태인 초대가 있으면 새로 만들지 않고 재발송을 쓰라고 안내한다.
- **재발송은 같은 레코드를 재사용**: 새 토큰을 발급하고 만료일을 늘려 다시 보낸다.
  이전 토큰은 그 순간 무효가 된다(같은 Invitation 행의 tokenHash가 바뀌므로). 실제로
  이전 토큰으로 접속하면 거부되는 것을 확인했다.
- **취소는 상태만 REVOKED로 바꾼다** — 레코드를 지우지 않으므로 "누가 언제 초대를
  취소했는가"가 남는다(다만 "누가"는 아직 감사기록에 남기지 않는다).
- 주체(Subject) 미리 연결하기는 아직 없다 — 주체를 검색해 고르는 화면이 없어서다.
  지금은 가입 시 자동으로 최소 정보의 주체가 만들어진다(§"인증 흐름" 참고).

## 화면과 요구사항 번호의 연결

`src/app` 폴더 구조는 v1.0 §6(화면 구성)의 R1 화면과 §5(FR 번호)에 맞춰 배치했다.
아직 로직이 없는 화면은 `ScreenPlaceholder` 컴포넌트로 표시해, 어떤 화면이 "존재하지만
비어 있는지"와 "아직 라우트조차 없는지"를 구분할 수 있게 했다. `activities/`와 인증
흐름 전체는 실제로 DB에 붙여 스택이 동작하는지 확인했고, 나머지 화면의 데이터 연동은
이후 작업이다.

## 아직 없는 것 (의도적으로 비워둠)

- **역할별 화면 커스터마이징**: 지금은 "들어올 수 있는가/없는가"만 있고, 역할에 따라
  메뉴나 화면 내용 자체를 다르게 보여주는 것은 없다(v1.0 §8의 역할별 홈 화면 등).
- **활동·기구 선택형 UI**: 역할 관리 화면에서 범위를 활동/기구로 좁힐 때 ID를 직접
  입력해야 한다 — 활동 관리 화면이 생기면 선택형으로 바꿀 대상이다.
- **역할 부여 이력 조회**: 종료된(과거) 역할 부여를 보는 화면이 없다 — DB에는 남아있다.
- **참여 신청·배치(FR-05) 실제 구현**: `ActivityAssignment` 화면은 아직 자리표시자다.
- **주체 검색·연결 UI**: 초대 시 기존 주체를 찾아 미리 연결하는 화면이 없다 — 지금은
  항상 새 주체를 자동 생성한다. 동명이인·중복 주체 정리 화면도 없다.
- **첨부파일 업로드**: 기여 증빙은 "선택"이라 스키마에는 있지만, S3/MinIO 연동
  (ADR-0001)이 없어 업로드 UI 자체를 만들지 않았다.
- **알림 발송(BullMQ/Redis), 로그인 요청 속도 제한**: 백그라운드 작업 큐가 아직 없다.
- **Docker Compose 배포 설정**: 로컬 검증은 이 컨테이너에 설치된 PostgreSQL로 직접 진행했다.

## 로컬 실행

```bash
npm install
cp .env.example .env        # DATABASE_URL, APP_BASE_URL, TOTP_ENCRYPTION_KEY 등을 채운다
                             # TOTP_ENCRYPTION_KEY 생성: openssl rand -base64 32
npx prisma migrate dev
npx tsx prisma/bootstrap-admin.ts you@example.org   # 최초 관리자 초대
npm run dev                  # http://localhost:3000
```

`RESEND_API_KEY`를 비워두면 실제 발송 없이 콘솔에 로그인·초대 링크가 출력된다.

## 검증 이력

- `npm run build`, `npm run lint` 통과
- 로컬 PostgreSQL 16을 대상으로 `next start` 실행 후 다음을 실제로 확인:
  - 비로그인 상태로 `/` 접근 시 `/login`으로 리다이렉트
  - 초대 수락 → 계정 생성 → TOTP 강제 등록 → 복구코드 발급까지 전체 플로우
  - 재로그인(매직링크) 시 이미 등록된 TOTP는 코드 입력 화면으로 감
  - 잘못된 TOTP 코드 거부, 올바른 코드 통과
  - 매직링크 토큰 재사용 거부(1회용)
  - 복구코드로 로그인 성공 후 같은 코드 재사용 시 거부(1회용)
  - 로그아웃 후 보호된 화면 재접근 시 `/login`으로 리다이렉트
  - **계정을 정지(SUSPENDED)로 바꾸면, 만료되지 않은 기존 세션 쿠키로도 즉시 접근이
    막힘**(FR-01의 핵심 요건)
  - 서로 다른 두 계정(조합원 1명·활동 책임자 1명 — 후자는 SYSTEM_ADMIN 역할이라 TOTP도
    함께 확인)으로 다음을 실제로 확인:
    - 활동/필요 모두 선택하지 않은 임시저장 성공(BR-01), 그 상태로 제출 시도하면 거부
    - 활동 연결 후 제출 → 상태가 SUBMITTED로 바뀜
    - 작성자 본인이 자신의 기여를 확인하려 하면 거부(self_confirm), 담당 범위 밖의
      기여를 확인하려 하면 거부(forbidden)
    - 담당자가 보완을 요청하면 NEEDS_REVISION으로 바뀌고, 같은 화면에서 고쳐 재제출하면
      같은 레코드(같은 displayId)가 다시 SUBMITTED로 바뀜 — 중복 레코드 생성 없음
    - 확인된 기여에 "정정 요청"을 하면 새 레코드(revisionOfId로 연결)가 생기고, 원본은
      확인 전까지 그대로 유지됨(BR-04). 새 레코드가 확인되면 원본이 SUPERSEDED로 바뀌고
      새 레코드를 가리킴(BR-05)
    - 같은 제출 키로 요청을 3개 동시에 보내도 레코드가 1건만 생성됨(BR-06/AT-04) —
      DB 유일 제약 위반을 잡아 조용히 넘어가도록 처리해 검증함
  - 역할 기반 접근 제어: SYSTEM_ADMIN 계정은 `/admin`·`/review` 모두 접근 가능; 역할도
    없고 담당 활동·수요도 없는 일반 계정은 둘 다 `/forbidden`으로 밀려남; 그 계정을
    역할 없이 어떤 활동의 담당자로만 지정하면 `/review`는 통과하되 `/admin`은 여전히
    막힘(소유권이 다른 화면 권한까지 주지 않음); 만료된 역할 부여(`endDate`가 과거)는
    무효로 취급되고, 유효한 부여로 바꾸면 즉시 통과됨
  - 역할 관리 화면(`/admin/roles`): 관리자가 다른 계정에 전체(GLOBAL) 역할 부여 성공;
    범위를 특정 활동으로 지정하면서 ID를 비우면 거부, ID를 채우면 성공; 부여한 역할을
    종료하면 `endDate`가 채워지고 목록에서 사라짐; 관리자가 자신의 마지막 관리자
    역할을 스스로 종료하려 하면 차단되고 역할은 그대로 유지됨; 역할이 없는 일반
    계정은 이 화면과 grant/revoke API 양쪽 모두에서 `/forbidden`으로 밀려남(직접
    API를 호출해도 막힘)
  - 초대 관리 화면(`/admin/invitations`): 역할을 지정한 초대 발급 성공, 콘솔에 초대
    링크 출력(dev 이메일 폴백) 확인; 같은 이메일로 중복 초대 시도 거부(already_invited),
    이미 가입된 이메일 초대 시도 거부(already_registered), 형식이 틀린 이메일 거부;
    재발송하면 새 토큰이 발급되고 옛 토큰은 즉시 무효화됨(실제로 옛 토큰 접속이
    거부되는 것을 확인); 초대를 수락하면 지정한 역할이 실제로 부여됨(TOTP 비대상
    역할은 TOTP 없이 바로 홈 진입); 취소한 초대는 상태가 REVOKED로 바뀌고 그 토큰으로
    접속 시 거부됨; SECRETARIAT/SYSTEM_ADMIN이 아닌 역할(DOMAIN_OPERATOR로 테스트)은
    이 화면과 초대 발급 API 양쪽 모두에서 차단됨
