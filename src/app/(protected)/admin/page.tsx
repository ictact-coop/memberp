import { requireRole } from "@/lib/auth/roles";
import { ScreenPlaceholder } from "@/components/ScreenPlaceholder";

// 관리자 설정 — 역할, 코드, 정책, 감사기록, 백업 상태.
// v1.0 §3 역할표: 초대·계정 정리는 사무국, 감사기록·백업은 시스템 관리자 몫이라
// 둘 다 허용한다. 그 외 역할(조합원, 활동 책임자 등)은 /forbidden으로 보낸다.
export default async function AdminPage() {
  await requireRole(["SECRETARIAT", "SYSTEM_ADMIN"]);

  return (
    <ScreenPlaceholder
      title="관리자 설정"
      frCode="FR-01, FR-11"
      description="초대·계정 상태, 권한, 감사기록, 백업 상태를 관리하는 화면입니다."
    />
  );
}
