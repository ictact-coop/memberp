import { getActiveSession } from "@/lib/auth/session";
import { ScreenPlaceholder } from "@/components/ScreenPlaceholder";

// 내 정보 — FR-03. 연락처 등 자기 정보 수정, 조합원 자격은 별도 처리.
// 로그인 이메일·로그아웃만 실제로 붙였고, 나머지 항목(관심·연락 선호 수정)은 아직 자리표시자다.
export default async function MyProfilePage() {
  const active = await getActiveSession();

  return (
    <section>
      <p style={{ fontSize: 12, color: "#888888" }}>FR-03</p>
      <h1 style={{ fontSize: 20, marginTop: 0 }}>내 정보</h1>
      <p style={{ color: "#555555" }}>로그인 계정: {active?.account.email}</p>

      <form method="POST" action="/api/auth/logout">
        <button type="submit" style={{ padding: "10px 16px", fontSize: 16 }}>
          로그아웃
        </button>
      </form>

      <ScreenPlaceholder
        title="연락처·관심 분야"
        frCode="FR-03"
        description="연락처·관심 분야 등 본인 정보를 확인·수정하는 화면입니다."
      />
    </section>
  );
}
