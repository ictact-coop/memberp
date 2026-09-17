import { requireRole } from "@/lib/auth/roles";
import { prisma } from "@/lib/prisma";
import { ROLE_LABELS } from "@/lib/role-labels";

const ERROR_MESSAGES: Record<string, string> = {
  invalid_email: "올바른 이메일 주소를 입력하세요.",
  already_registered: "이미 가입된 이메일입니다. 역할 관리에서 역할을 부여하세요.",
  already_invited: "이미 처리 대기 중인 초대장이 있습니다. 재발송을 이용하세요.",
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "대기 중",
  ACCEPTED: "가입 완료",
  EXPIRED: "만료됨",
  REVOKED: "취소됨",
};

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// 초대 발급 — FR-01. 지금까지는 prisma/bootstrap-admin.ts 스크립트로만 만들 수
// 있었다. SECRETARIAT/SYSTEM_ADMIN만 들어올 수 있다.
export default async function AdminInvitationsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireRole(["SECRETARIAT", "SYSTEM_ADMIN"]);
  const { error } = await searchParams;

  const invitations = await prisma.invitation.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const acceptedAccountIds = invitations
    .map((invitation) => invitation.acceptedAccountId)
    .filter((id): id is string => id !== null);
  const acceptedAccounts = await prisma.account.findMany({
    where: { id: { in: acceptedAccountIds } },
    select: { id: true, email: true },
  });
  const accountEmailById = new Map(acceptedAccounts.map((account) => [account.id, account.email]));

  const now = new Date();

  return (
    <section>
      <h1 style={{ fontSize: 20 }}>초대 관리</h1>
      {error && ERROR_MESSAGES[error] && <p style={{ color: "#c0392b" }}>{ERROR_MESSAGES[error]}</p>}

      <h2 style={{ fontSize: 16 }}>새 초대 보내기</h2>
      <form method="POST" action="/api/admin/invitations/create" style={{ marginBottom: 24 }}>
        <label htmlFor="contact" style={{ display: "block", fontSize: 14, marginBottom: 4 }}>
          이메일
        </label>
        <input
          id="contact"
          name="contact"
          type="email"
          required
          style={{ width: "100%", padding: 10, fontSize: 16, marginBottom: 12 }}
        />

        <label htmlFor="suggestedRole" style={{ display: "block", fontSize: 14, marginBottom: 4 }}>
          역할 — 선택하지 않으면 기본 조합원 권한으로 가입합니다
        </label>
        <select
          id="suggestedRole"
          name="suggestedRole"
          defaultValue=""
          style={{ width: "100%", padding: 10, fontSize: 16, marginBottom: 16 }}
        >
          <option value="">선택 안 함(조합원)</option>
          {Object.entries(ROLE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        <button type="submit" style={{ padding: "10px 16px", fontSize: 16 }}>
          초대 보내기
        </button>
      </form>

      <h2 style={{ fontSize: 16 }}>보낸 초대</h2>
      {invitations.length === 0 ? (
        <p style={{ color: "#555555" }}>아직 보낸 초대가 없습니다.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {invitations.map((invitation) => {
            const isPending = invitation.status === "PENDING";
            const isExpired = isPending && invitation.expiresAt < now;
            const statusLabel = isExpired ? "만료됨" : STATUS_LABELS[invitation.status];
            const acceptedEmail = invitation.acceptedAccountId
              ? accountEmailById.get(invitation.acceptedAccountId)
              : null;

            return (
              <li key={invitation.id} style={{ borderBottom: "1px solid #e0e0e0", padding: "12px 0" }}>
                <div>
                  <strong>{invitation.contact}</strong>{" "}
                  {invitation.suggestedRole && `· ${ROLE_LABELS[invitation.suggestedRole]}`}
                </div>
                <div style={{ fontSize: 12, color: "#888888" }}>
                  {statusLabel} · 만료일 {formatDate(invitation.expiresAt)}
                  {acceptedEmail && ` · 가입 계정: ${acceptedEmail}`}
                </div>

                {isPending && (
                  <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                    <form method="POST" action={`/api/admin/invitations/${invitation.id}/resend`}>
                      <button type="submit" style={{ fontSize: 12, padding: "4px 10px" }}>
                        재발송
                      </button>
                    </form>
                    <form method="POST" action={`/api/admin/invitations/${invitation.id}/revoke`}>
                      <button type="submit" style={{ fontSize: 12, padding: "4px 10px" }}>
                        취소
                      </button>
                    </form>
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
