import Link from "next/link";
import { requireRole } from "@/lib/auth/roles";
import { ScreenPlaceholder } from "@/components/ScreenPlaceholder";

// 관리자 설정 — 역할, 코드, 정책, 감사기록, 백업 상태.
// v1.0 §3 역할표: 초대·계정 정리는 사무국, 감사기록·백업은 시스템 관리자 몫이라
// 둘 다 허용한다. 그 외 역할(조합원, 활동 책임자 등)은 /forbidden으로 보낸다.
export default async function AdminPage() {
  await requireRole(["SECRETARIAT", "SYSTEM_ADMIN"]);

  return (
    <section>
      <h1 style={{ fontSize: 20 }}>관리자 설정</h1>
      <p>
        <Link href="/admin/invitations">초대 관리 →</Link>
      </p>
      <p>
        <Link href="/admin/roles">역할 관리 →</Link>
      </p>
      <p>
        <Link href="/admin/org-units">기구 관리 →</Link>
      </p>
      <p>
        <Link href="/admin/audit-log">상태 이력 조회 →</Link>
      </p>
      <ScreenPlaceholder
        title="계정 상태, 백업 상태"
        frCode="FR-01, FR-11"
        description="아직 구현되지 않았습니다."
      />
    </section>
  );
}
