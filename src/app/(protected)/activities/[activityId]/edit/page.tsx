import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireActiveSession } from "@/lib/auth/session";
import { MANAGEMENT_TYPE_LABELS, MISSION_LABELS, VISIBILITY_LABELS } from "@/lib/activity-labels";

const ERROR_MESSAGES: Record<string, string> = {
  invalid: "제목·목적·유형·책임자·미션(1개 이상)을 모두 입력하세요.",
  invalid_manager: "선택한 책임자 계정을 확인할 수 없습니다.",
  invalid_dates: "종료 예정일은 시작 예정일보다 빠를 수 없습니다.",
};

function toDateInputValue(date: Date | null): string {
  return date ? date.toISOString().slice(0, 10) : "";
}

// 활동 수정 — FR-04. 등록 화면과 같은 필드를 고친다. 책임자만 접근할 수 있고
// (상태 전이와 같은 원칙), 종료·취소된 활동은 "수정은 정정 이력"(v0.1 §3.2)이라
// 이 화면 대신 별도 정정 절차가 필요하므로 여기서는 막는다(그 절차는 아직 없음).
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

  const accounts = await prisma.account.findMany({
    where: { status: "ACTIVE" },
    orderBy: { email: "asc" },
    include: { subject: { select: { name: true } } },
  });

  return (
    <section>
      <h1 style={{ fontSize: 20 }}>활동 수정</h1>
      {error && ERROR_MESSAGES[error] && <p style={{ color: "#c0392b" }}>{ERROR_MESSAGES[error]}</p>}

      <form method="POST" action={`/api/activities/${activity.id}/update`}>
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
