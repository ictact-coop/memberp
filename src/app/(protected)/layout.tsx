import { redirect } from "next/navigation";
import { getActiveSession } from "@/lib/auth/session";
import { BottomNav } from "@/components/BottomNav";

// 이 그룹 아래 모든 화면은 로그인(그리고 필요하다면 TOTP까지)을 마쳐야 볼 수 있다.
// 역할별 접근 제한(예: /admin은 SYSTEM_ADMIN만)은 아직 여기 없다 — 인증과 인가는
// 별개 작업이며, 이번 범위는 "로그인이 되어 있는가"까지다.
export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const active = await getActiveSession();

  if (!active) {
    redirect("/login");
  }
  if (active.session.pendingSecondFactor) {
    redirect(active.account.totpEnabledAt ? "/login/totp" : "/login/totp/setup");
  }

  return (
    <>
      {children}
      <BottomNav />
    </>
  );
}
