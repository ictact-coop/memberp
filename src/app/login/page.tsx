import { redirect } from "next/navigation";
import { getActiveSession } from "@/lib/auth/session";

const ERROR_MESSAGES: Record<string, string> = {
  invalid_email: "올바른 이메일 주소를 입력하세요.",
  invalid_token: "링크가 만료되었거나 이미 사용되었습니다. 다시 요청하세요.",
  already_registered: "이미 가입된 이메일입니다. 로그인을 이용하세요.",
  prelink_conflict: "이 초대가 연결하려던 사람 정보가 이미 다른 계정과 연결되었습니다. 사무국에 문의하세요.",
};

// FR-01: 이미 로그인된 사람이 다시 /login에 오면 헷갈리지 않도록 홈으로 보낸다.
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const active = await getActiveSession();
  if (active && !active.session.pendingSecondFactor) {
    redirect("/");
  }

  const { error } = await searchParams;
  const errorMessage = error ? ERROR_MESSAGES[error] : undefined;

  return (
    <section>
      <h1 style={{ fontSize: 20 }}>로그인</h1>
      <p style={{ color: "var(--color-text-muted)" }}>
        가입할 때 등록한 이메일 주소로 로그인 링크를 보내드립니다.
      </p>
      {errorMessage && <p style={{ color: "var(--color-danger)" }}>{errorMessage}</p>}
      <form method="POST" action="/api/auth/login" className="card">
        <label htmlFor="email" style={{ display: "block", fontSize: 14, marginBottom: 4 }}>
          이메일
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          style={{ width: "100%", padding: 10, fontSize: 16, marginBottom: 12 }}
        />
        <button type="submit" style={{ padding: "10px 16px", fontSize: 16, width: "100%" }}>
          로그인 링크 받기
        </button>
      </form>
    </section>
  );
}
