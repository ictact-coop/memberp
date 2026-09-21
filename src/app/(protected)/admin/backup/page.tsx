import { requireRole } from "@/lib/auth/roles";
import { prisma } from "@/lib/prisma";

interface BackupSummary {
  [key: string]: number;
}

// 관리자 전체 데이터 내보내기 — SECRETARIAT/SYSTEM_ADMIN만(/admin의 다른 화면과
// 같은 권한). 병행운영전략 v0.2 §"v0.1 참여 시범" 범위의 "내보내기·백업"을 구현한다.
export default async function AdminBackupPage() {
  await requireRole(["SECRETARIAT", "SYSTEM_ADMIN"]);

  const recentExports = await prisma.auditLog.findMany({
    where: { entityType: "Backup", action: "EXPORT" },
    orderBy: { occurredAt: "desc" },
    take: 20,
  });
  const actorIds = Array.from(
    new Set(recentExports.map((log) => log.actorAccountId).filter((id): id is string => id !== null)),
  );
  const actors = await prisma.account.findMany({
    where: { id: { in: actorIds } },
    select: { id: true, email: true, phone: true },
  });
  const actorLabelById = new Map(actors.map((a) => [a.id, a.email ?? a.phone ?? a.id]));

  return (
    <section>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>데이터 백업</h1>
      <p style={{ color: "var(--color-text-muted)", fontSize: 13, marginTop: 0 }}>
        사람·활동·상담·기여·권한·이력 등 업무 데이터 전체를 JSON 파일 하나로 내려받습니다.
        로그인 세션·복구코드·2단계 인증 비밀 같은 인증 정보는 포함하지 않습니다 —
        이 백업은 업무 데이터 이전·복구용입니다.
      </p>

      <form method="POST" action="/api/admin/backup/export" className="card" style={{ marginBottom: 24 }}>
        <button type="submit" style={{ padding: "10px 16px", fontSize: 16 }}>
          전체 데이터 내보내기 (JSON)
        </button>
      </form>

      <h2 style={{ fontSize: 16 }}>내보내기 이력</h2>
      {recentExports.length === 0 ? (
        <p className="card" style={{ color: "var(--color-text-muted)" }}>
          아직 내보낸 기록이 없습니다.
        </p>
      ) : (
        <ul className="card-list">
          {recentExports.map((log) => {
            const counts = (log.afterData as BackupSummary | null) ?? {};
            const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
            return (
              <li key={log.id} className="card">
                <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                  {log.occurredAt.toISOString().slice(0, 19).replace("T", " ")}
                </div>
                <div style={{ fontWeight: 600, margin: "2px 0" }}>
                  {log.actorAccountId ? actorLabelById.get(log.actorAccountId) ?? log.actorAccountId : "(알 수 없음)"}
                </div>
                <div style={{ fontSize: 13, color: "var(--color-text-muted)" }}>총 {total}행</div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
