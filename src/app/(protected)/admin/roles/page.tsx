import type { ScopeType } from "@prisma/client";
import { requireRole } from "@/lib/auth/roles";
import { prisma } from "@/lib/prisma";
import { ROLE_LABELS, SCOPE_TYPE_LABELS } from "@/lib/role-labels";

const ERROR_MESSAGES: Record<string, string> = {
  invalid: "선택한 계정 또는 역할을 확인할 수 없습니다.",
  scope_ambiguous: "활동과 기구를 동시에 선택할 수 없습니다. 하나만 고르세요.",
  invalid_scope: "선택한 활동 또는 입력한 기구 ID를 확인할 수 없습니다.",
  self_lockout: "본인의 마지막 관리자 권한은 스스로 종료할 수 없습니다. 다른 관리자에게 요청하세요.",
};

function todayInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

// 역할 부여 — v0.1 §4.10 "권한 부여 DB". SECRETARIAT/SYSTEM_ADMIN만 들어올 수 있다.
// 역할을 부여하는 관리자 화면 자체가 없었던 이전까지는 초대 시 1회 부여하거나
// DB를 직접 조작하는 방법뿐이었다.
export default async function AdminRolesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireRole(["SECRETARIAT", "SYSTEM_ADMIN"]);
  const { error } = await searchParams;

  const now = new Date();
  const [accounts, activities, orgUnits] = await Promise.all([
    prisma.account.findMany({
      orderBy: { createdAt: "asc" },
      take: 200,
      include: {
        subject: { select: { name: true } },
        permissionGrants: {
          where: {
            startDate: { lte: now },
            OR: [{ endDate: null }, { endDate: { gte: now } }],
          },
          orderBy: { createdAt: "desc" },
        },
      },
    }),
    prisma.activity.findMany({
      where: { archivedAt: null },
      orderBy: { createdAt: "desc" },
      select: { id: true, displayId: true, title: true },
    }),
    prisma.subject.findMany({
      where: { type: "ORG_UNIT", archivedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, displayId: true, name: true },
    }),
  ]);

  const activityLabelById = new Map(activities.map((a) => [a.id, `${a.displayId} · ${a.title}`]));
  const orgUnitLabelById = new Map(orgUnits.map((o) => [o.id, `${o.displayId} · ${o.name}`]));

  function scopeLabel(scopeType: ScopeType, scopeId: string | null) {
    if (scopeType === "GLOBAL" || !scopeId) return null;
    const name =
      scopeType === "ACTIVITY" ? (activityLabelById.get(scopeId) ?? scopeId) : (orgUnitLabelById.get(scopeId) ?? scopeId);
    return `${SCOPE_TYPE_LABELS[scopeType]}: ${name}`;
  }

  return (
    <section>
      <h1 style={{ fontSize: 20 }}>역할 관리</h1>
      {error && ERROR_MESSAGES[error] && <p style={{ color: "#c0392b" }}>{ERROR_MESSAGES[error]}</p>}

      <h2 style={{ fontSize: 16 }}>역할 부여</h2>
      <form method="POST" action="/api/admin/roles/grant" style={{ marginBottom: 24 }}>
        <label htmlFor="accountId" style={{ display: "block", fontSize: 14, marginBottom: 4 }}>
          계정
        </label>
        <select
          id="accountId"
          name="accountId"
          required
          style={{ width: "100%", padding: 10, fontSize: 16, marginBottom: 12 }}
        >
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.email ?? account.phone} {account.subject?.name ? `(${account.subject.name})` : ""}
            </option>
          ))}
        </select>

        <label htmlFor="role" style={{ display: "block", fontSize: 14, marginBottom: 4 }}>
          역할
        </label>
        <select
          id="role"
          name="role"
          required
          style={{ width: "100%", padding: 10, fontSize: 16, marginBottom: 12 }}
        >
          {Object.entries(ROLE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        <label htmlFor="scopeActivityId" style={{ display: "block", fontSize: 14, marginBottom: 4 }}>
          범위를 특정 활동으로 제한 — 전체 범위면 "선택 안 함"을 둡니다
        </label>
        <select
          id="scopeActivityId"
          name="scopeActivityId"
          defaultValue=""
          style={{ width: "100%", padding: 10, fontSize: 16, marginBottom: 12 }}
        >
          <option value="">선택 안 함</option>
          {activities.map((activity) => (
            <option key={activity.id} value={activity.id}>
              {activity.displayId} · {activity.title}
            </option>
          ))}
        </select>

        <label htmlFor="scopeOrgUnitId" style={{ display: "block", fontSize: 14, marginBottom: 4 }}>
          범위를 특정 기구로 제한 — 위 활동과 동시에 선택할 수 없습니다
        </label>
        {orgUnits.length > 0 ? (
          <select
            id="scopeOrgUnitId"
            name="scopeOrgUnitId"
            defaultValue=""
            style={{ width: "100%", padding: 10, fontSize: 16, marginBottom: 4 }}
          >
            <option value="">선택 안 함</option>
            {orgUnits.map((orgUnit) => (
              <option key={orgUnit.id} value={orgUnit.id}>
                {orgUnit.displayId} · {orgUnit.name}
              </option>
            ))}
          </select>
        ) : (
          <input
            id="scopeOrgUnitId"
            name="scopeOrgUnitId"
            style={{ width: "100%", padding: 10, fontSize: 16, marginBottom: 4 }}
          />
        )}
        <p style={{ fontSize: 12, color: "#888888", marginTop: 0, marginBottom: 12 }}>
          {orgUnits.length > 0
            ? "등록된 기구(Subject) 중에서 고릅니다."
            : "등록된 기구가 아직 없어 ID를 직접 입력해야 합니다 — /admin/org-units에서 기구를 먼저 등록하면 선택형으로 바뀝니다."}
        </p>

        <label htmlFor="startDate" style={{ display: "block", fontSize: 14, marginBottom: 4 }}>
          시작일
        </label>
        <input
          id="startDate"
          name="startDate"
          type="date"
          defaultValue={todayInputValue()}
          style={{ width: "100%", padding: 10, fontSize: 16, marginBottom: 12 }}
        />

        <label htmlFor="endDate" style={{ display: "block", fontSize: 14, marginBottom: 4 }}>
          종료일 — 임기가 정해져 있지 않으면 비워둡니다
        </label>
        <input
          id="endDate"
          name="endDate"
          type="date"
          style={{ width: "100%", padding: 10, fontSize: 16, marginBottom: 16 }}
        />

        <button type="submit" style={{ padding: "10px 16px", fontSize: 16 }}>
          역할 부여
        </button>
      </form>

      <h2 style={{ fontSize: 16 }}>계정별 현재 역할</h2>
      <ul style={{ listStyle: "none", padding: 0 }}>
        {accounts.map((account) => (
          <li key={account.id} style={{ borderBottom: "1px solid #e0e0e0", padding: "12px 0" }}>
            <div>
              <strong>{account.email ?? account.phone}</strong>
              {account.subject?.name ? ` · ${account.subject.name}` : ""} · {account.status}
            </div>
            {account.permissionGrants.length === 0 ? (
              <div style={{ fontSize: 12, color: "#888888" }}>부여된 역할 없음(기본 조합원 권한)</div>
            ) : (
              <ul style={{ listStyle: "none", padding: 0, marginTop: 4 }}>
                {account.permissionGrants.map((grant) => (
                  <li key={grant.id} style={{ fontSize: 14, marginBottom: 4 }}>
                    {ROLE_LABELS[grant.role]}
                    {(() => {
                      const label = scopeLabel(grant.scopeType, grant.scopeId);
                      return label ? ` (${label})` : "";
                    })()}
                    {grant.endDate ? ` — ${grant.endDate.toISOString().slice(0, 10)}까지` : ""}{" "}
                    <form
                      method="POST"
                      action={`/api/admin/roles/${grant.id}/revoke`}
                      style={{ display: "inline" }}
                    >
                      <button type="submit" style={{ fontSize: 12, padding: "2px 8px" }}>
                        종료
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
