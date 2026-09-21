import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireActiveSession } from "@/lib/auth/session";
import { NEED_CHANNEL_LABELS } from "@/lib/need-labels";
import { VISIBILITY_LABELS } from "@/lib/activity-labels";

const ERROR_MESSAGES: Record<string, string> = {
  invalid: "제목·내용·경로·접수일·담당자를 모두 입력하세요.",
  invalid_assignee: "선택한 담당자 계정을 확인할 수 없습니다.",
  invalid_budget: "예산 상한은 하한보다 작을 수 없습니다.",
};

function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// 상담·수요 수정 — FR-08. 접수 화면과 같은 필드를 고친다. 담당자만 접근할 수
// 있고(상태 전이와 같은 원칙), 사업화·종결된 건은 v0.1 §3.1대로 잠근다.
export default async function EditNeedPage({
  params,
  searchParams,
}: {
  params: Promise<{ needId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const active = await requireActiveSession();
  const { needId } = await params;
  const { error } = await searchParams;

  const need = await prisma.need.findUnique({ where: { id: needId } });
  if (!need) {
    notFound();
  }
  if (need.assigneeAccountId !== active.account.id) {
    redirect(`/needs/${needId}?error=forbidden`);
  }
  if (need.status === "CLOSED" || need.status === "CONVERTED") {
    redirect(`/needs/${needId}?error=locked`);
  }

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
      <h1 style={{ fontSize: 20 }}>상담·수요 수정</h1>
      {error && ERROR_MESSAGES[error] && (
        <p style={{ color: "var(--color-danger)" }}>{ERROR_MESSAGES[error]}</p>
      )}

      <form method="POST" action={`/api/needs/${need.id}/update`} className="card">
        <label htmlFor="title" style={{ display: "block", fontSize: 14, marginBottom: 4 }}>
          제목
        </label>
        <input
          id="title"
          name="title"
          required
          defaultValue={need.title}
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
          defaultValue={need.content}
          style={{ width: "100%", padding: 10, fontSize: 16, marginBottom: 12 }}
        />

        <label htmlFor="channel" style={{ display: "block", fontSize: 14, marginBottom: 4 }}>
          접수 경로
        </label>
        <select
          id="channel"
          name="channel"
          defaultValue={need.channel}
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
          defaultValue={toDateInputValue(need.receivedAt)}
          style={{ width: "100%", padding: 10, fontSize: 16, marginBottom: 12 }}
        />

        <label htmlFor="assigneeAccountId" style={{ display: "block", fontSize: 14, marginBottom: 4 }}>
          담당자
        </label>
        <select
          id="assigneeAccountId"
          name="assigneeAccountId"
          required
          defaultValue={need.assigneeAccountId ?? ""}
          style={{ width: "100%", padding: 10, fontSize: 16, marginBottom: 12 }}
        >
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.email ?? account.phone} {account.subject?.name ? `(${account.subject.name})` : ""}
            </option>
          ))}
        </select>
        <p style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: -8, marginBottom: 12 }}>
          담당자를 바꾸면 이후 상태 전이·수정은 새 담당자만 할 수 있습니다.
        </p>

        <label htmlFor="raisedBySubjectId" style={{ display: "block", fontSize: 14, marginBottom: 4 }}>
          제기한 사람·단체 (선택)
        </label>
        <select
          id="raisedBySubjectId"
          name="raisedBySubjectId"
          defaultValue={need.raisedBySubjectId ?? ""}
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
          대상(수혜) 사람·단체 (선택)
        </label>
        <select
          id="beneficiarySubjectId"
          name="beneficiarySubjectId"
          defaultValue={need.beneficiarySubjectId ?? ""}
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
          defaultValue={need.urgency ?? ""}
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
          defaultValue={need.budgetMin?.toString() ?? ""}
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
          defaultValue={need.budgetMax?.toString() ?? ""}
          style={{ width: "100%", padding: 10, fontSize: 16, marginBottom: 12 }}
        />

        <label htmlFor="visibility" style={{ display: "block", fontSize: 14, marginBottom: 4 }}>
          공개 범위
        </label>
        <select
          id="visibility"
          name="visibility"
          defaultValue={need.visibility}
          style={{ width: "100%", padding: 10, fontSize: 16, marginBottom: 16 }}
        >
          {Object.entries(VISIBILITY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        <button type="submit" style={{ padding: "10px 16px", fontSize: 16 }}>
          저장
        </button>
      </form>
    </section>
  );
}
