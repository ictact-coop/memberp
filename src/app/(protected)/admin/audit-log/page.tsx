import { requireRole } from "@/lib/auth/roles";
import { prisma } from "@/lib/prisma";
import { AuditLogEntries } from "@/components/AuditLogEntries";

// 상태 이력 조회 — 활동·상담 상태 전이, 활동·내 정보 수정이 남긴 AuditLog를
// 사람이 보는 화면. v1.0 §3 역할표: 감사기록은 시스템 관리자 몫이라
// SECRETARIAT/SYSTEM_ADMIN만 들어올 수 있다(/admin의 다른 화면과 같은 권한).
export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ entityType?: string; entityId?: string }>;
}) {
  await requireRole(["SECRETARIAT", "SYSTEM_ADMIN"]);
  const { entityType, entityId } = await searchParams;

  const [entityTypes, logs] = await Promise.all([
    prisma.auditLog.findMany({
      distinct: ["entityType"],
      select: { entityType: true },
      orderBy: { entityType: "asc" },
    }),
    prisma.auditLog.findMany({
      where: {
        ...(entityType ? { entityType } : {}),
        ...(entityId ? { entityId } : {}),
      },
      orderBy: { occurredAt: "desc" },
      take: 200,
    }),
  ]);

  const actorIds = Array.from(
    new Set(logs.map((log) => log.actorAccountId).filter((id): id is string => id !== null)),
  );
  const actors = await prisma.account.findMany({
    where: { id: { in: actorIds } },
    select: { id: true, email: true, phone: true },
  });
  const actorLabelById = new Map(actors.map((a) => [a.id, a.email ?? a.phone ?? a.id]));

  return (
    <section>
      <h1 style={{ fontSize: 20 }}>상태 이력 조회</h1>
      <p style={{ fontSize: 12, color: "#888888" }}>
        활동·상담·수요 상태 전이, 활동·내 정보 수정 등이 남긴 변경 기록입니다.
      </p>

      <form method="GET" style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <select name="entityType" defaultValue={entityType ?? ""} style={{ padding: 8, fontSize: 14 }}>
          <option value="">전체 종류</option>
          {entityTypes.map(({ entityType: type }) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
        <input
          name="entityId"
          placeholder="대상 ID로 좁히기"
          defaultValue={entityId ?? ""}
          style={{ padding: 8, fontSize: 14, flex: 1, minWidth: 200 }}
        />
        <button type="submit" style={{ padding: "8px 14px", fontSize: 14 }}>
          검색
        </button>
      </form>

      <AuditLogEntries logs={logs} actorLabelById={actorLabelById} />
    </section>
  );
}
