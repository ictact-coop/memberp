import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireActiveSession } from "@/lib/auth/session";
import { MANAGEMENT_TYPE_LABELS, MISSION_LABELS, VISIBILITY_LABELS } from "@/lib/activity-labels";
import { getSelfAndDescendantActivityIds } from "@/lib/activity-hierarchy";

const ERROR_MESSAGES: Record<string, string> = {
  invalid: "제목·목적·유형·책임자·미션(1개 이상)을 모두 입력하세요.",
  invalid_manager: "선택한 책임자 계정을 확인할 수 없습니다.",
  invalid_approver: "선택한 결재 위임 대상 계정을 확인할 수 없습니다.",
  approver_same_as_manager: "결재 위임 대상은 책임자 본인과 다른 계정이어야 합니다.",
  invalid_dates: "종료 예정일은 시작 예정일보다 빠를 수 없습니다.",
  invalid_parent: "선택한 상위 활동을 확인할 수 없습니다.",
  invalid_parent_cycle: "그 활동을 상위 활동으로 지정하면 순환이 생깁니다.",
  invalid_budget: "예산은 0 이상의 숫자여야 합니다.",
};

function toDateInputValue(date: Date | null): string {
  return date ? date.toISOString().slice(0, 10) : "";
}

// 활동 수정 — FR-04. 등록 화면과 같은 필드를 고친다. 책임자만 접근할 수 있고
// (상태 전이와 같은 원칙), 종료·취소된 활동은 "수정은 정정 이력"(v0.1 §3.2)이라
// 이 화면 대신 정정 이력 화면(/activities/[id]/revise)을 써야 한다.
export default async function EditActivityPage({
  params,
  searchParams,
}: {
  params: Promise<{ activityId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const active = await requireActiveSession();
  const { activityId } = await params;
  const { error } = await searchParams;

  const activity = await prisma.activity.findUnique({ where: { id: activityId } });
  if (!activity) {
    notFound();
  }
  if (activity.managerAccountId !== active.account.id) {
    redirect(`/activities/${activityId}?error=forbidden`);
  }
  if (activity.status === "CLOSED" || activity.status === "CANCELLED") {
    redirect(`/activities/${activityId}?error=locked`);
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
  // 자기 자신과 모든 하위 활동은 상위 활동 후보에서 뺀다 — 순환(A→B→A) 방지.
  const excludedParentIds = await getSelfAndDescendantActivityIds(prisma, activityId);
  const parentCandidates = allActivities.filter((candidate) => !excludedParentIds.has(candidate.id));

  return (
    <section>
      <h1 style={{ fontSize: 20 }}>활동 수정</h1>
      {error && ERROR_MESSAGES[error] && (
        <p style={{ color: "var(--color-danger)" }}>{ERROR_MESSAGES[error]}</p>
      )}

      <form method="POST" action={`/api/activities/${activity.id}/update`} className="card">
        <label htmlFor="title" style={{ display: "block", fontSize: 14, marginBottom: 4 }}>
          활동명
        </label>
        <input
          id="title"
          name="title"
          required
          defaultValue={activity.title}
          style={{ width: "100%", padding: 10, fontSize: 16, marginBottom: 12 }}
        />

        <label htmlFor="managementType" style={{ display: "block", fontSize: 14, marginBottom: 4 }}>
          유형
        </label>
        <select
          id="managementType"
          name="managementType"
          defaultValue={activity.managementType}
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
          defaultValue={activity.purpose}
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
                defaultChecked={activity.missions.includes(value as (typeof activity.missions)[number])}
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
          defaultValue={activity.parentActivityId ?? ""}
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
          defaultValue={activity.budgetBaseline?.toString() ?? ""}
          style={{ width: "100%", padding: 10, fontSize: 16, marginBottom: 12 }}
        />

        <label htmlFor="managerAccountId" style={{ display: "block", fontSize: 14, marginBottom: 4 }}>
          책임자
        </label>
        <select
          id="managerAccountId"
          name="managerAccountId"
          required
          defaultValue={activity.managerAccountId}
          style={{ width: "100%", padding: 10, fontSize: 16, marginBottom: 12 }}
        >
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.email ?? account.phone} {account.subject?.name ? `(${account.subject.name})` : ""}
            </option>
          ))}
        </select>
        <p style={{ fontSize: 12, color: "#888888", marginTop: -8, marginBottom: 12 }}>
          책임자를 바꾸면 이후 상태 전이·신청 수락은 새 책임자만 할 수 있습니다.
        </p>

        <label htmlFor="approverAccountId" style={{ display: "block", fontSize: 14, marginBottom: 4 }}>
          결재 위임 (선택)
        </label>
        <select
          id="approverAccountId"
          name="approverAccountId"
          defaultValue={activity.approverAccountId ?? ""}
          style={{ width: "100%", padding: 10, fontSize: 16, marginBottom: 12 }}
        >
          <option value="">위임 안 함 — 책임자 본인이 승인</option>
          {accounts
            .filter((account) => account.id !== activity.managerAccountId)
            .map((account) => (
              <option key={account.id} value={account.id}>
                {account.email ?? account.phone} {account.subject?.name ? `(${account.subject.name})` : ""}
              </option>
            ))}
        </select>
        <p style={{ fontSize: 12, color: "#888888", marginTop: -8, marginBottom: 12 }}>
          지정하면 "준비 승인" 단계의 승인·반려는 이 계정만 할 수 있고, 책임자
          본인은 자기 활동을 스스로 승인할 수 없습니다. 그 외 처리(승인 요청·시작·
          종료 등)는 여전히 책임자만 할 수 있습니다.
        </p>

        <label htmlFor="visibility" style={{ display: "block", fontSize: 14, marginBottom: 4 }}>
          공개 범위
        </label>
        <select
          id="visibility"
          name="visibility"
          defaultValue={activity.visibility}
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
          defaultValue={toDateInputValue(activity.plannedStartDate)}
          style={{ width: "100%", padding: 10, fontSize: 16, marginBottom: 12 }}
        />

        <label htmlFor="plannedEndDate" style={{ display: "block", fontSize: 14, marginBottom: 4 }}>
          종료 예정일
        </label>
        <input
          id="plannedEndDate"
          name="plannedEndDate"
          type="date"
          defaultValue={toDateInputValue(activity.plannedEndDate)}
          style={{ width: "100%", padding: 10, fontSize: 16, marginBottom: 16 }}
        />

        <button type="submit" style={{ padding: "10px 16px", fontSize: 16 }}>
          저장
        </button>
      </form>
    </section>
  );
}
