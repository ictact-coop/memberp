import { NextResponse } from "next/server";
import { getActiveSession, markSecondFactorVerified } from "@/lib/auth/session";
import { consumeRecoveryCode, verifyTotpForAccount } from "@/lib/auth/totp";
import { checkRateLimit } from "@/lib/rate-limit";
import { TOTP_VERIFY_RATE_LIMIT } from "@/lib/auth/config";

export async function POST(request: Request) {
  const active = await getActiveSession();
  if (!active) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (!active.session.pendingSecondFactor) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // 계정당 제한 — 6자리 코드·복구코드 모두 이 표시(입력) 창구 하나를 거치므로
  // 여기서 막으면 두 방식 모두 브루트포스를 막는다.
  const allowed = await checkRateLimit("totp_verify", active.account.id, TOTP_VERIFY_RATE_LIMIT);
  if (!allowed) {
    return NextResponse.redirect(new URL("/login/totp?error=rate_limited", request.url));
  }

  const formData = await request.formData();
  const code = formData.get("code");
  const mode = formData.get("mode");

  if (typeof code !== "string") {
    return NextResponse.redirect(new URL("/login/totp?error=1", request.url));
  }

  const verified =
    mode === "recovery"
      ? await consumeRecoveryCode(active.account.id, code)
      : await verifyTotpForAccount(active.account.id, code);

  if (!verified) {
    return NextResponse.redirect(new URL("/login/totp?error=1", request.url));
  }

  await markSecondFactorVerified(active.session.id);
  return NextResponse.redirect(new URL("/", request.url));
}
