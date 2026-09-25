import { requireRole } from "@/lib/auth/roles";
import { prisma } from "@/lib/prisma";
import {
  ACCOUNT_STATUS_ACTION_LABELS,
  ACCOUNT_STATUS_BADGE_TONE,
  ACCOUNT_STATUS_LABELS,
  ACCOUNT_STATUS_TRANSITIONS,
  availableAccountStatusActions,
} from "@/lib/account-status";

const ERROR_MESSAGES: Record<string, string> = {
  invalid_transition: "지금 상태에서는 그 처리를 할 수 없습니다.",
  reason_required: "사유를 입력해야 합니다.",
  cannot_change_self: "자기 자신의 계정 상태는 이 화면에서 바꿀 수 없습니다.",
};

// 계정 상태 관리 — FR-01. 관리자 허브에 자리표시자로만 남아 있던 화면을 채운다.
// 지금까지 계정을 정지·탈퇴 처리하려면 DB를 직접 만져야 했다 — 세션 검증
// (getActiveSession)은 이미 status==="ACTIVE"만 통과시키므로, 여기서는 상태
// 전이 규칙과 감사기록만 신경 쓰면 된다.
export default async function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; error?: string }>;
}) {
  const active = await requireRole(["SECRETARIAT", "SYSTEM_ADMIN"]);
  const { q, error } = await searchParams;
  const query = q?.trim();

  const accounts = await prisma.account.findMany({
    where: query
      ? {
          OR: [
            { email: { contains: query, mode: "insensitive" } },
            { phone: { contains: query, mode: "insensitive" } },
            { subject: { name: { contains: query, mode: "insensitive" } } },
          ],
        }
      : undefined,
    include: { subject: { select: { name: true, displayId: true } } },
    orderBy: { createdAt: "asc" },
    take: 200,
  });

  return (
    <section>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>계정 상태 관리</h1>
      <p style={{ color: "var(--color-text-muted)", fontSize: 13, marginTop: 0 }}>
        계정을 정지·재활성화·탈퇴 처리합니다. 정지·탈퇴된 계정은 그 즉시(이미 로그인된
        세션 포함) 접근이 막힙니다.
      </p>
      {error && ERROR_MESSAGES[error] && <p style={{ color: "#c0392b" }}>{ERROR_MESSAGES[error]}</p>}

      <form method="GET" style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input
          name="q"
          defaultValue={query ?? ""}
          placeholder="이메일·전화번호·이름으로 검색"
          style={{ padding: 8, fontSize: 14, flex: 1 }}
        />
        <button type="submit" style={{ padding: "8px 14px", fontSize: 14 }}>
          검색
        </button>
      </form>

      {accounts.length === 0 ? (
        <p className="card" style={{ color: "var(--color-text-muted)" }}>
          조건에 맞는 계정이 없습니다.
        </p>
      ) : (
        <ul className="card-list">
          {accounts.map((account) => {
            const actions = availableAccountStatusActions(account.status);
            const isSelf = account.id === active.account.id;
            return (
              <li key={account.id} className="card">
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <strong>{account.email ?? account.phone}</strong>
                  <span className={`badge ${ACCOUNT_STATUS_BADGE_TONE[account.status]}`}>
                    {ACCOUNT_STATUS_LABELS[account.status]}
                  </span>
                  {isSelf && (
                    <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>(나)</span>
                  )}
                </div>
                {account.subject && (
                  <div style={{ fontSize: 13, color: "var(--color-text-muted)", marginTop: 2 }}>
                    {account.subject.displayId} · {account.subject.name}
                  </div>
                )}
                {isSelf ? (
                  <p style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 8, marginBottom: 0 }}>
                    자기 자신의 계정 상태는 바꿀 수 없습니다.
                  </p>
                ) : actions.length === 0 ? (
                  <p style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 8, marginBottom: 0 }}>
                    이 상태에서 처리할 수 있는 전이가 없습니다.
                  </p>
                ) : (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                    {actions.map((action) => {
                      const reasonRequired = ACCOUNT_STATUS_TRANSITIONS[action].reasonRequired;
                      return (
                        <form
                          key={action}
                          method="POST"
                          action={`/api/admin/accounts/${account.id}/status`}
                          style={{ display: "flex", flexDirection: "column", gap: 6 }}
                        >
                          <input type="hidden" name="action" value={action} />
                          {reasonRequired && (
                            <textarea
                              name="reason"
                              required
                              placeholder="사유 (필수)"
                              rows={2}
                              style={{ width: 200, padding: 6, fontSize: 13 }}
                            />
                          )}
                          <button type="submit" style={{ padding: "6px 12px", fontSize: 13 }}>
                            {ACCOUNT_STATUS_ACTION_LABELS[action]}
                          </button>
                        </form>
                      );
                    })}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
