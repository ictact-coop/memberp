import { redirect } from "next/navigation";
import { getActiveSession } from "@/lib/auth/session";
import { createTotpEnrollment, renderTotpQrCode } from "@/lib/auth/totp";

// ADR-0002: 임원·재무·운영관리자 역할로 처음 로그인하면 TOTP 등록을 강제한다.
// 비밀키는 여기서만 화면에 노출되고, 확인 성공 후에는 암호화된 형태로만 저장된다.
export default async function TotpSetupPage({
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
  if (active.account.totpEnabledAt) {
    redirect("/login/totp");
  }
  if (!active.account.email) {
    throw new Error("TOTP 등록에는 이메일이 필요합니다.");
  }

  const { error } = await searchParams;
  const { base32Secret, otpauthUrl } = createTotpEnrollment(active.account.email);
  const qrDataUrl = await renderTotpQrCode(otpauthUrl);

  return (
    <section>
      <h1 style={{ fontSize: 20 }}>2단계 인증 설정</h1>
      <p style={{ color: "var(--color-text-muted)" }}>
        이 계정은 역할상 2단계 인증이 필요합니다. Google Authenticator 등 OTP 앱으로 아래
        QR코드를 스캔한 뒤, 앱에 표시된 6자리 코드를 입력해 확인하세요.
      </p>

      <div className="card" style={{ textAlign: "center" }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- 서버에서 생성한 data URL이라 next/image 최적화 대상이 아님 */}
        <img src={qrDataUrl} alt="OTP 앱으로 스캔할 QR코드" width={200} height={200} />
        <p style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 0 }}>
          QR코드를 스캔할 수 없다면 이 코드를 직접 입력하세요: <code>{base32Secret}</code>
        </p>
      </div>

      {error && (
        <p style={{ color: "var(--color-danger)" }}>코드가 올바르지 않습니다. 다시 시도하세요.</p>
      )}

      <form method="POST" action="/api/auth/totp/setup" className="card">
        <input type="hidden" name="secret" value={base32Secret} />
        <label htmlFor="code" style={{ display: "block", fontSize: 14, marginBottom: 4 }}>
          앱에 표시된 6자리 코드
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
          확인하고 활성화
        </button>
      </form>
    </section>
  );
}
