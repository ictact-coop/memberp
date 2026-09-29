import { requireRole } from "@/lib/auth/roles";
import { prisma } from "@/lib/prisma";
import { AuditLogEntries } from "@/components/AuditLogEntries";
import { AuditLogPagination } from "@/components/AuditLogPagination";
import { AUDIT_LOG_PAGE_SIZE, parseAuditLogPage } from "@/lib/audit-labels";

// 상태 이력 조회 — 활동·상담 상태 전이, 활동·내 정보 수정이 남긴 AuditLog를
// 사람이 보는 화면. v1.0 §3 역할표: 감사기록은 시스템 관리자 몫이라
// SECRETARIAT/SYSTEM_ADMIN만 들어올 수 있다(/admin의 다른 화면과 같은 권한).
export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ entityType?: string; entityId?: string; page?: string }>;
}) {
  await requireRole(["SECRETARIAT", "SYSTEM_ADMIN"]);
  const { entityType, entityId, page: pageRaw } = await searchParams;

  const where = {
    ...(entityType ? { entityType } : {}),
    ...(entityId ? { entityId } : {}),
  };

  const [entityTypes, total] = await Promise.all([
    prisma.auditLog.findMany({
      distinct: ["entityType"],
      select: { entityType: true },
      orderBy: { entityType: "asc" },
    }),
    prisma.auditLog.count({ where }),
  ]);

  // 요청된 page가 실제 마지막 페이지보다 크면(필터를 바꿔 결과가 줄어든 경우 등)
  // 조용히 마지막 페이지로 맞춘다 — 빈 화면 대신 있는 결과를 보여준다.
  const totalPages = Math.max(1, Math.ceil(total / AUDIT_LOG_PAGE_SIZE));
  const page = Math.min(parseAuditLogPage(pageRaw), totalPages);

  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: { occurredAt: "desc" },
    skip: (page - 1) * AUDIT_LOG_PAGE_SIZE,
    take: AUDIT_LOG_PAGE_SIZE,
  });

  const buildHref = (targetPage: number) => {
    const params = new URLSearchParams();
    if (entityType) params.set("entityType", entityType);
    if (entityId) params.set("entityId", entityId);
    if (targetPage > 1) params.set("page", String(targetPage));
    const qs = params.toString();
    return qs ? `/admin/audit-log?${qs}` : "/admin/audit-log";
  };

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
      <AuditLogPagination page={page} pageSize={AUDIT_LOG_PAGE_SIZE} total={total} buildHref={buildHref} />
    </section>
  );
}
