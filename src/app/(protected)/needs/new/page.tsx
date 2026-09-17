import { prisma } from "@/lib/prisma";
import { ACTIVITY_OPERATIONS_ROLES, requireRole } from "@/lib/auth/roles";
import { NEED_CHANNEL_LABELS } from "@/lib/need-labels";
import { VISIBILITY_LABELS } from "@/lib/activity-labels";

const ERROR_MESSAGES: Record<string, string> = {
  invalid: "제목·내용·경로·접수일·담당자를 모두 입력하세요.",
  invalid_assignee: "선택한 담당자 계정을 확인할 수 없습니다.",
  invalid_budget: "예산 상한은 하한보다 작을 수 없습니다.",
};

function todayInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

// 상담·수요 접수 — FR-08. v0.1 §3.1: 담당자가 있어야 다음 전이(접수→확인중)의
// 조건("담당·다음 행동일")을 채울 수 있으므로 담당자는 등록 시 필수로 받는다.
export default async function NewNeedPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireRole(ACTIVITY_OPERATIONS_ROLES);
  const { error } = await searchParams;

  const [accounts, subjects] = await Promise.all([
    prisma.account.findMany({
      where: { status: "ACTIVE" },
      orderBy: { email: "asc" },
      include: { subject: { select: { name: true } } },
    }),
    prisma.subject.findMany({
      where: { archivedAt: null },
      orderBy: { name: "asc" },
      take: 200,
      select: { id: true, displayId: true, name: true },
    }),
  ]);

  return (
    <section>
      <h1 style={{ fontSize: 20 }}>새 상담·수요 접수</h1>
      {error && ERROR_MESSAGES[error] && <p style={{ color: "#c0392b" }}>{ERROR_MESSAGES[error]}</p>}

      <form method="POST" action="/api/needs/create">
        <label htmlFor="title" style={{ display: "block", fontSize: 14, marginBottom: 4 }}>
          제목
        </label>
        <input
          id="title"
          name="title"
          required
          style={{ width: "100%", padding: 10, fontSize: 16, marginBottom: 12 }}
        />

        <label htmlFor="content" style={{ display: "block", fontSize: 14, marginBottom: 4 }}>
          내용
        </label>
        <textarea
          id="content"
          name="content"
          rows={3}
          required
          style={{ width: "100%", padding: 10, fontSize: 16, marginBottom: 12 }}
        />

        <label htmlFor="channel" style={{ display: "block", fontSize: 14, marginBottom: 4 }}>
          접수 경로
        </label>
        <select
          id="channel"
          name="channel"
          style={{ width: "100%", padding: 10, fontSize: 16, marginBottom: 12 }}
        >
          {Object.entries(NEED_CHANNEL_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        <label htmlFor="receivedAt" style={{ display: "block", fontSize: 14, marginBottom: 4 }}>
          접수일
        </label>
        <input
          id="receivedAt"
          name="receivedAt"
          type="date"
          required
          defaultValue={todayInputValue()}
          style={{ width: "100%", padding: 10, fontSize: 16, marginBottom: 12 }}
        />

        <label htmlFor="assigneeAccountId" style={{ display: "block", fontSize: 14, marginBottom: 4 }}>
          담당자
        </label>
        <select
          id="assigneeAccountId"
          name="assigneeAccountId"
          required
          style={{ width: "100%", padding: 10, fontSize: 16, marginBottom: 12 }}
        >
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.email ?? account.phone} {account.subject?.name ? `(${account.subject.name})` : ""}
            </option>
          ))}
        </select>

        <label htmlFor="raisedBySubjectId" style={{ display: "block", fontSize: 14, marginBottom: 4 }}>
          제기한 사람·단체 (선택)
        </label>
        <select
          id="raisedBySubjectId"
          name="raisedBySubjectId"
          defaultValue=""
          style={{ width: "100%", padding: 10, fontSize: 16, marginBottom: 12 }}
        >
          <option value="">선택 안 함</option>
          {subjects.map((subject) => (
            <option key={subject.id} value={subject.id}>
              {subject.displayId} · {subject.name}
            </option>
          ))}
        </select>

        <label htmlFor="beneficiarySubjectId" style={{ display: "block", fontSize: 14, marginBottom: 4 }}>
          대상(수혜) 사람·단체 (선택 — 나중에 "확인 시작" 단계에서 채워도 됩니다)
        </label>
        <select
          id="beneficiarySubjectId"
          name="beneficiarySubjectId"
          defaultValue=""
          style={{ width: "100%", padding: 10, fontSize: 16, marginBottom: 12 }}
        >
          <option value="">선택 안 함</option>
          {subjects.map((subject) => (
            <option key={subject.id} value={subject.id}>
              {subject.displayId} · {subject.name}
            </option>
          ))}
        </select>

        <label htmlFor="urgency" style={{ display: "block", fontSize: 14, marginBottom: 4 }}>
          긴급도 (선택, 자유 입력)
        </label>
        <input
          id="urgency"
          name="urgency"
          style={{ width: "100%", padding: 10, fontSize: 16, marginBottom: 12 }}
        />

        <label htmlFor="budgetMin" style={{ display: "block", fontSize: 14, marginBottom: 4 }}>
          예상 예산 하한 (선택)
        </label>
        <input
          id="budgetMin"
          name="budgetMin"
          type="number"
          step="0.01"
          style={{ width: "100%", padding: 10, fontSize: 16, marginBottom: 12 }}
        />

        <label htmlFor="budgetMax" style={{ display: "block", fontSize: 14, marginBottom: 4 }}>
          예상 예산 상한 (선택)
        </label>
        <input
          id="budgetMax"
          name="budgetMax"
          type="number"
          step="0.01"
          style={{ width: "100%", padding: 10, fontSize: 16, marginBottom: 12 }}
        />

        <label htmlFor="visibility" style={{ display: "block", fontSize: 14, marginBottom: 4 }}>
          공개 범위
        </label>
        <select
          id="visibility"
          name="visibility"
          defaultValue="TEAM"
          style={{ width: "100%", padding: 10, fontSize: 16, marginBottom: 16 }}
        >
          {Object.entries(VISIBILITY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        <button type="submit" style={{ padding: "10px 16px", fontSize: 16 }}>
          접수
        </button>
      </form>
    </section>
  );
}
