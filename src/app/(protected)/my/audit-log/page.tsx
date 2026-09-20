import { prisma } from "@/lib/prisma";
import { requireActiveSession } from "@/lib/auth/session";
import { AuditLogEntries } from "@/components/AuditLogEntries";

// 내 담당 이력 — v1.0 "활동 책임자·상담 담당자가 내가 담당한 항목의 변경 이력만
// 보는 화면"을 채운다. /admin/audit-log는 시스템 관리자 전용(v1.0 역할표)이라
// 일반 책임자·담당자는 자기가 맡은 활동·상담이라도 그 변경 이력을 볼 방법이
// 없었다. 역할 게이트 없이 로그인만 하면 들어올 수 있고, 대신 조회 범위 자체를
// "내가 managerAccountId·assigneeAccountId인 항목"으로 좁힌다 — 남의 활동·
// 상담 이력은 여기서도 볼 수 없다.
export default async function MyAuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ entityType?: string; entityId?: string }>;
}) {
  const active = await requireActiveSession();
  const { entityType, entityId } = await searchParams;

  const [managedActivities, assignedNeeds] = await Promise.all([
    prisma.activity.findMany({
      where: { managerAccountId: active.account.id },
      select: { id: true },
    }),
    prisma.need.findMany({
      where: { assigneeAccountId: active.account.id },
      select: { id: true },
    }),
  ]);
  const activityIds = managedActivities.map((a) => a.id);
  const needIds = assignedNeeds.map((n) => n.id);

  const scopedWhere = {
    OR: [
      { entityType: "Activity", entityId: { in: activityIds } },
      { entityType: "Need", entityId: { in: needIds } },
    ],
  };

  const logs = await prisma.auditLog.findMany({
    where: {
      AND: [
        scopedWhere,
        entityType ? { entityType } : {},
        entityId ? { entityId } : {},
      ],
    },
    orderBy: { occurredAt: "desc" },
    take: 200,
  });

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
      <h1 style={{ fontSize: 20 }}>내 담당 이력</h1>
      <p style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
        내가 책임자·담당자인 활동·상담·수요의 상태 전이·정보 수정 기록입니다.
      </p>

      <form method="GET" style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <select name="entityType" defaultValue={entityType ?? ""} style={{ padding: 8, fontSize: 14 }}>
          <option value="">전체 종류</option>
          <option value="Activity">Activity</option>
          <option value="Need">Need</option>
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
