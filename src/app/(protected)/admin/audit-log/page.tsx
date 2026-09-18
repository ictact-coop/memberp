import Link from "next/link";
import { requireRole } from "@/lib/auth/roles";
import { prisma } from "@/lib/prisma";
import { AUDIT_ACTION_LABELS, diffAuditData } from "@/lib/audit-labels";

function formatDateTime(date: Date): string {
  return date.toISOString().slice(0, 16).replace("T", " ");
}

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

  function entityLink(type: string, id: string): string | null {
    if (type === "Activity") return `/activities/${id}`;
    if (type === "Need") return `/needs/${id}`;
    return null;
  }

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

      {logs.length === 0 ? (
        <p style={{ color: "#555555" }}>조건에 맞는 이력이 없습니다.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {logs.map((log) => {
            const diffs = diffAuditData(log.beforeData, log.afterData);
            const link = entityLink(log.entityType, log.entityId);
            return (
              <li key={log.id} style={{ borderBottom: "1px solid #e0e0e0", padding: "12px 0" }}>
                <div style={{ fontSize: 12, color: "#888888" }}>
                  {formatDateTime(log.occurredAt)} ·{" "}
                  {log.actorAccountId ? actorLabelById.get(log.actorAccountId) ?? log.actorAccountId : "시스템"}
                </div>
                <div>
                  <strong>{AUDIT_ACTION_LABELS[log.action]}</strong> · {log.entityType}{" "}
                  {link ? (
                    <Link href={link} style={{ fontSize: 12 }}>
                      {log.entityId.slice(0, 8)}…
                    </Link>
                  ) : (
                    <span style={{ fontSize: 12, color: "#888888" }}>{log.entityId.slice(0, 8)}…</span>
                  )}
                </div>
                {diffs.length > 0 && (
                  <ul style={{ fontSize: 12, color: "#555555", marginTop: 4, paddingLeft: 16 }}>
                    {diffs.map((diff) => (
                      <li key={diff.key}>
                        {diff.key}: {diff.before} → {diff.after}
                      </li>
                    ))}
                  </ul>
                )}
                {log.reason && (
                  <div style={{ fontSize: 12, color: "#555555", marginTop: 4 }}>사유: {log.reason}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
