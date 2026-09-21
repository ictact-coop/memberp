import { NextResponse } from "next/server";
import { requestLoginLink } from "@/lib/auth/login";
import { checkRateLimit } from "@/lib/rate-limit";
import { LOGIN_REQUEST_RATE_LIMIT } from "@/lib/auth/config";

export async function POST(request: Request) {
  const formData = await request.formData();
  const email = formData.get("email");

  if (typeof email !== "string" || !email.includes("@")) {
    return NextResponse.redirect(new URL("/login?error=invalid_email", request.url));
  }

  // 계정 존재 여부와 무관하게 같은 이메일 문자열 자체로 제한한다 — 계정이 없는
  // 주소도 똑같이 걸려야 "이 이메일은 계정이 있다/없다"가 새어나가지 않는다.
  const allowed = await checkRateLimit("login_request", email.trim().toLowerCase(), LOGIN_REQUEST_RATE_LIMIT);
  if (!allowed) {
    return NextResponse.redirect(new URL("/login?error=rate_limited", request.url));
  }

  await requestLoginLink(email);

  const redirectUrl = new URL("/login/check-email", request.url);
  redirectUrl.searchParams.set("email", email);
  return NextResponse.redirect(redirectUrl);
}
