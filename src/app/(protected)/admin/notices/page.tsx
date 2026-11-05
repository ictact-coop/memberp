import { requireRole } from "@/lib/auth/roles";
import { prisma } from "@/lib/prisma";
import { ROLE_LABELS } from "@/lib/role-labels";

const ROLE_OPTIONS = [
  "MEMBER",
  "ACTIVITY_MANAGER",
  "DOMAIN_OPERATOR",
  "SECRETARIAT",
  "FINANCE",
  "BOARD",
  "SYSTEM_ADMIN",
  "EXTERNAL_PARTICIPANT",
] as const;

const ERROR_MESSAGES: Record<string, string> = {
  invalid: "제목을 입력하고, 받는 대상을 선택하세요.",
  invalid_roles: "받을 역할을 하나 이상 고르세요.",
  no_recipients: "그 조건에 맞는 계정이 없습니다 — 다른 역할을 골라 보세요.",
};

interface NoticeLogData {
  title?: string;
  scope?: string;
  roles?: string[] | null;
  recipientCount?: number;
}

// 공지사항 발송 — NotificationType.GENERIC(FR-10, "알림 화면" 절)이 그동안
// 아무 데서도 안 쓰던 자리를 채운다. SECRETARIAT·SYSTEM_ADMIN이 전체 활성
// 계정 또는 특정 역할에게 앱 내 알림(`/my/notifications`)을 한 번에 보낸다.
export default async function AdminNoticesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireRole(["SECRETARIAT", "SYSTEM_ADMIN"]);
  const { error } = await searchParams;

  const recentNotices = await prisma.auditLog.findMany({
    where: { entityType: "Notice", action: "CREATE" },
    orderBy: { occurredAt: "desc" },
    take: 20,
  });
  const actorIds = Array.from(
    new Set(recentNotices.map((log) => log.actorAccountId).filter((id): id is string => id !== null)),
  );
  const actors = await prisma.account.findMany({
    where: { id: { in: actorIds } },
    select: { id: true, email: true, phone: true },
  });
  const actorLabelById = new Map(actors.map((a) => [a.id, a.email ?? a.phone ?? a.id]));

  return (
    <section>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>공지사항 발송</h1>
      <p style={{ color: "var(--color-text-muted)", fontSize: 13, marginTop: 0 }}>
        전체 조합원 또는 특정 역할에게 앱 내 알림(/my/notifications)으로 공지를 보냅니다.
        이메일로는 따로 발송되지 않습니다.
      </p>
      {error && ERROR_MESSAGES[error] && <p style={{ color: "#c0392b" }}>{ERROR_MESSAGES[error]}</p>}

      <form method="POST" action="/api/admin/notices/send" className="card" style={{ marginBottom: 24 }}>
        <label htmlFor="title" style={{ display: "block", fontSize: 14, marginBottom: 4 }}>
          제목
        </label>
        <input
          id="title"
          name="title"
          required
          style={{ width: "100%", padding: 10, fontSize: 16, marginBottom: 12 }}
        />

        <label htmlFor="body" style={{ display: "block", fontSize: 14, marginBottom: 4 }}>
          내용 (선택)
        </label>
        <textarea
          id="body"
          name="body"
          rows={4}
          style={{ width: "100%", padding: 10, fontSize: 16, marginBottom: 12 }}
        />

        <fieldset style={{ border: "1px solid #e0e0e0", borderRadius: 6, padding: 12, marginBottom: 16 }}>
          <legend style={{ fontSize: 14 }}>받는 대상</legend>
          <label style={{ display: "block", fontSize: 14, marginBottom: 8 }}>
            <input type="radio" name="scope" value="ALL" defaultChecked /> 전체 활성 계정
          </label>
          <label style={{ display: "block", fontSize: 14, marginBottom: 8 }}>
            <input type="radio" name="scope" value="ROLES" /> 특정 역할
          </label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, paddingLeft: 24 }}>
            {ROLE_OPTIONS.map((role) => (
              <label key={role} style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 4 }}>
                <input type="checkbox" name="roles" value={role} />
                {ROLE_LABELS[role]}
              </label>
            ))}
          </div>
        </fieldset>

        <button type="submit" style={{ padding: "10px 16px", fontSize: 16 }}>
          발송
        </button>
      </form>

      <h2 style={{ fontSize: 16 }}>발송 이력</h2>
      {recentNotices.length === 0 ? (
        <p className="card" style={{ color: "var(--color-text-muted)" }}>
          아직 보낸 공지사항이 없습니다.
        </p>
      ) : (
        <ul className="card-list">
          {recentNotices.map((log) => {
            const data = (log.afterData as NoticeLogData | null) ?? {};
            return (
              <li key={log.id} className="card">
                <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                  {log.occurredAt.toISOString().slice(0, 19).replace("T", " ")} ·{" "}
                  {log.actorAccountId ? actorLabelById.get(log.actorAccountId) ?? log.actorAccountId : "(알 수 없음)"}
                </div>
                <div style={{ fontWeight: 600, margin: "2px 0" }}>{data.title ?? "(제목 없음)"}</div>
                <div style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
                  받는 대상:{" "}
                  {data.scope === "ROLES" && data.roles
                    ? data.roles.map((r) => ROLE_LABELS[r as (typeof ROLE_OPTIONS)[number]] ?? r).join(", ")
                    : "전체 활성 계정"}{" "}
                  · {data.recipientCount ?? 0}명
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
