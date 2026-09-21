import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireActiveSession } from "@/lib/auth/session";
import { MANAGEMENT_TYPE_LABELS, MISSION_LABELS, VISIBILITY_LABELS } from "@/lib/activity-labels";
import { getSelfAndDescendantActivityIds } from "@/lib/activity-hierarchy";

const ERROR_MESSAGES: Record<string, string> = {
  invalid: "제목·목적·유형·책임자·미션(1개 이상)을 모두 입력하세요.",
  invalid_manager: "선택한 책임자 계정을 확인할 수 없습니다.",
  invalid_dates: "종료 예정일은 시작 예정일보다 빠를 수 없습니다.",
  invalid_parent: "선택한 상위 활동을 확인할 수 없습니다.",
  invalid_parent_cycle: "그 활동을 상위 활동으로 지정하면 순환이 생깁니다.",
  invalid_budget: "예산은 0 이상의 숫자여야 합니다.",
};

function toDateInputValue(date: Date | null): string {
  return date ? date.toISOString().slice(0, 10) : "";
}

// 활동 정정 이력 만들기 — v0.1 §3.2 "종료 후 수정은 정정 이력으로". 종료·취소된
// 활동의 등록 정보를 고치는 유일한 방법이다. 등록·수정 화면과 같은 필드를
// 원본 값으로 미리 채워 보여주고, 제출하면 원본을 대체하는 새 활동 행이
// 만들어진다(API가 참조 이전까지 처리한다). 책임자만 접근할 수 있고, 이미
// 정정된(대체된) 원본에서는 최신 버전으로 안내한다.
export default async function ReviseActivityPage({
  params,
  searchParams,
}: {
  params: Promise<{ activityId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const active = await requireActiveSession();
  const { activityId } = await params;
  const { error } = await searchParams;

  const original = await prisma.activity.findUnique({ where: { id: activityId } });
  if (!original) {
    notFound();
  }
  if (original.managerAccountId !== active.account.id) {
    redirect(`/activities/${activityId}?error=forbidden`);
  }
  if (original.status !== "CLOSED" && original.status !== "CANCELLED") {
    redirect(`/activities/${activityId}?error=not_locked`);
  }
  if (original.supersededByActivityId) {
    redirect(`/activities/${original.supersededByActivityId}?error=already_revised`);
  }

  const [accounts, allActivities] = await Promise.all([
    prisma.account.findMany({
      where: { status: "ACTIVE" },
      orderBy: { email: "asc" },
      include: { subject: { select: { name: true } } },
    }),
    prisma.activity.findMany({
      where: { archivedAt: null, supersededByActivityId: null },
      orderBy: { createdAt: "desc" },
      select: { id: true, displayId: true, title: true },
    }),
  ]);
  // 새 행은 원본이 트리에서 있던 자리를 물려받는다 — 원본 자신과 원본의 하위
  // 활동은 상위 활동 후보에서 뺀다(활동 수정 화면과 같은 순환 방지 원칙).
  const excludedParentIds = await getSelfAndDescendantActivityIds(prisma, activityId);
  const parentCandidates = allActivities.filter((candidate) => !excludedParentIds.has(candidate.id));

  return (
    <section>
      <p style={{ fontSize: 12, color: "var(--color-text-muted)" }}>{original.displayId}</p>
      <h1 style={{ fontSize: 20 }}>정정 이력 만들기</h1>
      <p style={{ color: "var(--color-text-muted)", fontSize: 13 }}>
        종료·취소된 활동은 직접 고칠 수 없습니다. 아래 내용으로 저장하면 이 활동을 대체하는
        새 활동이 만들어지고, 참여 배정·기여 등 이 활동과 연결된 기록은 모두 새 활동으로
        옮겨집니다. 원본은 지워지지 않고 "정정됨" 표시와 함께 그대로 남습니다.
      </p>
      {error && ERROR_MESSAGES[error] && (
        <p style={{ color: "var(--color-danger)" }}>{ERROR_MESSAGES[error]}</p>
      )}

      <form method="POST" action={`/api/activities/${original.id}/revise`} className="card">
        <label htmlFor="title" style={{ display: "block", fontSize: 14, marginBottom: 4 }}>
          활동명
        </label>
        <input
          id="title"
          name="title"
          required
          defaultValue={original.title}
          style={{ width: "100%", padding: 10, fontSize: 16, marginBottom: 12 }}
        />

        <label htmlFor="managementType" style={{ display: "block", fontSize: 14, marginBottom: 4 }}>
          유형
        </label>
        <select
          id="managementType"
          name="managementType"
          defaultValue={original.managementType}
          style={{ width: "100%", padding: 10, fontSize: 16, marginBottom: 12 }}
        >
          {Object.entries(MANAGEMENT_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        <label htmlFor="purpose" style={{ display: "block", fontSize: 14, marginBottom: 4 }}>
          목적·기대 변화
        </label>
        <textarea
          id="purpose"
          name="purpose"
          rows={3}
          required
          defaultValue={original.purpose}
          style={{ width: "100%", padding: 10, fontSize: 16, marginBottom: 12 }}
        />

        <fieldset style={{ border: "1px solid #e0e0e0", padding: 10, marginBottom: 12 }}>
          <legend style={{ fontSize: 14 }}>미션 (1개 이상)</legend>
          {Object.entries(MISSION_LABELS).map(([value, label]) => (
            <label key={value} style={{ display: "block", fontSize: 14, padding: "4px 0" }}>
              <input
                type="checkbox"
                name="missions"
                value={value}
                defaultChecked={original.missions.includes(value as (typeof original.missions)[number])}
              />{" "}
              {label}
            </label>
          ))}
        </fieldset>

        <label htmlFor="parentActivityId" style={{ display: "block", fontSize: 14, marginBottom: 4 }}>
          상위 활동 (선택)
        </label>
        <select
          id="parentActivityId"
          name="parentActivityId"
          defaultValue={original.parentActivityId ?? ""}
          style={{ width: "100%", padding: 10, fontSize: 16, marginBottom: 12 }}
        >
          <option value="">선택 안 함</option>
          {parentCandidates.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {candidate.displayId} · {candidate.title}
            </option>
          ))}
        </select>

        <label htmlFor="budgetBaseline" style={{ display: "block", fontSize: 14, marginBottom: 4 }}>
          예산 (선택, 원)
        </label>
        <input
          id="budgetBaseline"
          name="budgetBaseline"
          type="number"
          min="0"
          step="0.01"
          defaultValue={original.budgetBaseline?.toString() ?? ""}
          style={{ width: "100%", padding: 10, fontSize: 16, marginBottom: 12 }}
        />

        <label htmlFor="managerAccountId" style={{ display: "block", fontSize: 14, marginBottom: 4 }}>
          책임자
        </label>
        <select
          id="managerAccountId"
          name="managerAccountId"
          required
          defaultValue={original.managerAccountId}
          style={{ width: "100%", padding: 10, fontSize: 16, marginBottom: 12 }}
        >
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.email ?? account.phone} {account.subject?.name ? `(${account.subject.name})` : ""}
            </option>
          ))}
        </select>

        <label htmlFor="visibility" style={{ display: "block", fontSize: 14, marginBottom: 4 }}>
          공개 범위
        </label>
        <select
          id="visibility"
          name="visibility"
          defaultValue={original.visibility}
          style={{ width: "100%", padding: 10, fontSize: 16, marginBottom: 12 }}
        >
          {Object.entries(VISIBILITY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        <label htmlFor="plannedStartDate" style={{ display: "block", fontSize: 14, marginBottom: 4 }}>
          시작 예정일
        </label>
        <input
          id="plannedStartDate"
          name="plannedStartDate"
          type="date"
          defaultValue={toDateInputValue(original.plannedStartDate)}
          style={{ width: "100%", padding: 10, fontSize: 16, marginBottom: 12 }}
        />

        <label htmlFor="plannedEndDate" style={{ display: "block", fontSize: 14, marginBottom: 4 }}>
          종료 예정일
        </label>
        <input
          id="plannedEndDate"
          name="plannedEndDate"
          type="date"
          defaultValue={toDateInputValue(original.plannedEndDate)}
          style={{ width: "100%", padding: 10, fontSize: 16, marginBottom: 16 }}
        />

        <button type="submit" style={{ padding: "10px 16px", fontSize: 16 }}>
          정정 이력 저장
        </button>
      </form>
    </section>
  );
}
