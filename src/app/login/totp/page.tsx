import { redirect } from "next/navigation";
import { getActiveSession } from "@/lib/auth/session";

// ADR-0002: 임원·재무·운영관리자 역할 계정의 2단계 인증 코드 입력 화면.
export default async function TotpVerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const active = await getActiveSession();
  if (!active) {
    redirect("/login");
  }
  if (!active.session.pendingSecondFactor) {
    redirect("/");
  }
  if (!active.account.totpEnabledAt) {
    redirect("/login/totp/setup");
  }

  const { error } = await searchParams;

  return (
    <section>
      <h1 style={{ fontSize: 20 }}>2단계 인증</h1>
      <p style={{ color: "#555555" }}>OTP 앱에 표시된 6자리 코드를 입력하세요.</p>
      {error && <p style={{ color: "#c0392b" }}>코드가 올바르지 않습니다.</p>}

      <form method="POST" action="/api/auth/totp/verify" style={{ marginBottom: 24 }}>
        <input type="hidden" name="mode" value="totp" />
        <label htmlFor="code" style={{ display: "block", fontSize: 14, marginBottom: 4 }}>
          인증 코드
        </label>
        <input
          id="code"
          name="code"
          inputMode="numeric"
          pattern="[0-9]{6}"
          maxLength={6}
          required
          style={{ width: "100%", padding: 10, fontSize: 16, marginBottom: 12 }}
        />
        <button type="submit" style={{ padding: "10px 16px", fontSize: 16, width: "100%" }}>
          확인
        </button>
      </form>

      <details>
        <summary style={{ fontSize: 14, color: "#555555" }}>
          기기를 분실했나요? 복구 코드로 로그인
        </summary>
        <form method="POST" action="/api/auth/totp/verify" style={{ marginTop: 12 }}>
          <input type="hidden" name="mode" value="recovery" />
          <label htmlFor="recoveryCode" style={{ display: "block", fontSize: 14, marginBottom: 4 }}>
            복구 코드
          </label>
          <input
            id="recoveryCode"
            name="code"
            placeholder="XXXX-XXXX"
            required
            style={{ width: "100%", padding: 10, fontSize: 16, marginBottom: 12 }}
          />
          <button type="submit" style={{ padding: "10px 16px", fontSize: 16, width: "100%" }}>
            복구 코드로 로그인
          </button>
        </form>
      </details>
    </section>
  );
}
