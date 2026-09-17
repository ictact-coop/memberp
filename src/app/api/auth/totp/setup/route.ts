import { NextResponse } from "next/server";
import { getActiveSession, markSecondFactorVerified } from "@/lib/auth/session";
import { activateTotp, verifyTotpCode } from "@/lib/auth/totp";

export async function POST(request: Request) {
  const active = await getActiveSession();
  if (!active || !active.session.pendingSecondFactor) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const formData = await request.formData();
  const secret = formData.get("secret");
  const code = formData.get("code");

  if (typeof secret !== "string" || typeof code !== "string" || !verifyTotpCode(secret, code)) {
    return NextResponse.redirect(new URL("/login/totp/setup?error=1", request.url));
  }

  const recoveryCodes = await activateTotp(active.account.id, secret);
  await markSecondFactorVerified(active.session.id);

  const codeListHtml = recoveryCodes.map((recoveryCode) => `<li><code>${recoveryCode}</code></li>`).join("");
  const html = `<!doctype html>
<html lang="ko">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>복구 코드</title></head>
<body style="font-family: sans-serif; max-width: 480px; margin: 24px auto; padding: 0 16px;">
  <h1 style="font-size: 20px;">2단계 인증이 설정되었습니다</h1>
  <p>OTP 앱 기기를 분실했을 때 아래 복구 코드로 로그인할 수 있습니다. 각 코드는 한 번만
  사용할 수 있습니다. 지금 안전한 곳에 저장하세요 — 이 화면은 다시 볼 수 없습니다.</p>
  <ul style="font-size: 16px; line-height: 1.8;">${codeListHtml}</ul>
  <p><a href="/">계속하기 →</a></p>
</body>
</html>`;

  return new NextResponse(html, { headers: { "content-type": "text/html; charset=utf-8" } });
}
