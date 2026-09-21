import Link from "next/link";
import { requireRole } from "@/lib/auth/roles";
import { prisma } from "@/lib/prisma";
import { ROLE_LABELS } from "@/lib/role-labels";

const ERROR_MESSAGES: Record<string, string> = {
  invalid_email: "올바른 이메일 주소를 입력하세요.",
  already_registered: "이미 가입된 이메일입니다. 역할 관리에서 역할을 부여하세요.",
  already_invited: "이미 처리 대기 중인 초대장이 있습니다. 재발송을 이용하세요.",
  invalid_subject: "선택한 사람을 확인할 수 없습니다.",
  subject_already_invited: "그 사람은 이미 다른 대기 중인 초대에 연결되어 있습니다.",
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
  searchParams: Promise<{ error?: string; prelinked?: string }>;
}) {
  await requireRole(["SECRETARIAT", "SYSTEM_ADMIN"]);
  const { error, prelinked } = await searchParams;

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

  // 미리 연결할 수 있는 사람 = 계정이 아직 없는 사람 주체. 이미 다른 대기 중인
  // 초대에 연결된 사람도 빼서, 같은 사람을 두 초대가 동시에 노리는 상황을
  // 화면에서부터 막는다(레이스는 API에서 한 번 더 확인).
  const prelinkedIds = invitations
    .filter((i) => i.status === "PENDING")
    .map((i) => i.prelinkedSubjectId)
    .filter((id): id is string => id !== null);
  const prelinkCandidates = await prisma.subject.findMany({
    where: {
      type: "PERSON",
      archivedAt: null,
      account: null,
      id: { notIn: prelinkedIds },
    },
    orderBy: { name: "asc" },
  });
  const prelinkedSubjects = await prisma.subject.findMany({
    where: { id: { in: invitations.map((i) => i.prelinkedSubjectId).filter((id): id is string => id !== null) } },
    select: { id: true, displayId: true, name: true },
  });
  const prelinkedSubjectById = new Map(prelinkedSubjects.map((s) => [s.id, s]));

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
          style={{ width: "100%", padding: 10, fontSize: 16, marginBottom: 12 }}
        >
          <option value="">선택 안 함(조합원)</option>
          {Object.entries(ROLE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        <label htmlFor="prelinkedSubjectId" style={{ display: "block", fontSize: 14, marginBottom: 4 }}>
          미리 연결할 사람 (선택) — 고르지 않으면 가입 시 확인 대기 상태로 새로 만들어집니다
        </label>
        <select
          id="prelinkedSubjectId"
          name="prelinkedSubjectId"
          defaultValue={prelinked ?? ""}
          style={{ width: "100%", padding: 10, fontSize: 16, marginBottom: 4 }}
        >
          <option value="">선택 안 함(새로 만들기)</option>
          {prelinkCandidates.map((subject) => (
            <option key={subject.id} value={subject.id}>
              {subject.displayId} · {subject.name}
            </option>
          ))}
        </select>
        <p style={{ fontSize: 12, color: "#888888", marginTop: 0, marginBottom: 16 }}>
          목록에 없는 사람이라면 <Link href="/admin/subjects/new">사람 미리 등록</Link>에서 먼저
          만드세요.
        </p>

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
                  {invitation.prelinkedSubjectId &&
                    (() => {
                      const subject = prelinkedSubjectById.get(invitation.prelinkedSubjectId);
                      return subject
                        ? ` · 미리 연결: ${subject.displayId} · ${subject.name}`
                        : "";
                    })()}
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
