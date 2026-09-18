import Link from "next/link";
import { requireRole } from "@/lib/auth/roles";
import { ScreenPlaceholder } from "@/components/ScreenPlaceholder";

const TOOLS = [
  { href: "/admin/invitations", label: "초대 관리", description: "이메일로 초대 발급·재발송·취소" },
  { href: "/admin/roles", label: "역할 관리", description: "역할 부여·종료" },
  { href: "/admin/org-units", label: "기구 관리", description: "기구(Subject) 등록·목록" },
  { href: "/admin/audit-log", label: "상태 이력 조회", description: "활동·상담 상태 변경 기록" },
] as const;

// 관리자 설정 — 역할, 코드, 정책, 감사기록, 백업 상태.
// v1.0 §3 역할표: 초대·계정 정리는 사무국, 감사기록·백업은 시스템 관리자 몫이라
// 둘 다 허용한다. 그 외 역할(조합원, 활동 책임자 등)은 /forbidden으로 보낸다.
export default async function AdminPage() {
  await requireRole(["SECRETARIAT", "SYSTEM_ADMIN"]);

  return (
    <section>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>관리자 설정</h1>
      <p style={{ color: "var(--color-text-muted)", fontSize: 13, marginTop: 0 }}>
        조합 운영에 필요한 관리 도구 모음입니다.
      </p>
      <ul className="card-list">
        {TOOLS.map((tool) => (
          <li key={tool.href} className="card">
            <Link href={tool.href} style={{ textDecoration: "none" }}>
              <strong>{tool.label}</strong>
              <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 2 }}>
                {tool.description}
              </div>
            </Link>
          </li>
        ))}
      </ul>
      <div style={{ marginTop: 16 }}>
        <ScreenPlaceholder
          title="계정 상태, 백업 상태"
          frCode="FR-01, FR-11"
          description="아직 구현되지 않았습니다."
        />
      </div>
    </section>
  );
}
