import { NextResponse, type NextRequest } from "next/server";

// CSRF 방어(2차 — "아직 없는 것" 후보 중 하나). 로그인 세션 쿠키는 이미
// sameSite: "lax"로 발급하고 있어(src/lib/auth/session.ts) 크로스사이트 POST
// 자체는 대부분 막힌다. 그 위에 한 겹 더 둔다.
//
// 모든 폼이 자바스크립트 없는 순수 HTML <form>이라, 전통적인 동기화 토큰
// (각 폼에 숨은 필드로 토큰을 심고 각 API가 검증)을 쓰려면 수십 개 화면과
// 48개 POST API 라우트를 전부 고쳐야 한다 — 하나라도 빠뜨리면 그 기능이
// 조용히 막혀버리는 회귀 위험이 크다. 대신 브라우저가 상태를 바꾸는 요청에는
// 항상 실어 보내는 Origin(없으면 Referer) 헤더만으로 "이 요청이 우리 사이트
// 자신에게서 왔는가"를 미들웨어 한 곳에서 확인한다 — OWASP CSRF 치트시트가
// 인정하는 방어 기법("Verifying Origin with Standard Headers")이고, 기존
// 화면·API 코드는 한 줄도 건드리지 않는다. 새 POST 라우트가 추가돼도 이
// 파일 하나가 자동으로 적용되므로 "깜빡하고 안 넣었다"가 구조적으로
// 불가능하다.
const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function middleware(request: NextRequest) {
  if (!UNSAFE_METHODS.has(request.method)) {
    return NextResponse.next();
  }

  // nextUrl.origin은 이 요청 자신의 Host 헤더에서 나온다 — API 라우트 전체가
  // 리다이렉트 URL을 만들 때 쓰는 `new URL(path, request.url)`과 같은 기준이라
  // 배포 환경(로컬·Docker·운영)마다 새로 설정할 값이 없다.
  const expectedOrigin = request.nextUrl.origin;
  const originHeader = request.headers.get("origin");

  let requestOrigin: string | null = originHeader;
  if (!requestOrigin) {
    const refererHeader = request.headers.get("referer");
    try {
      requestOrigin = refererHeader ? new URL(refererHeader).origin : null;
    } catch {
      requestOrigin = null;
    }
  }

  // 둘 다 없으면(오래된 브라우저이거나, 이 헤더들을 보내지 않는 비브라우저
  // 클라이언트) 의심스러운 요청으로 보고 거부한다 — 정상적인 폼 제출은 항상
  // 둘 중 하나를 보낸다.
  if (!requestOrigin || requestOrigin !== expectedOrigin) {
    return new NextResponse("요청을 처리할 수 없습니다 (출처 확인 실패).", {
      status: 403,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
