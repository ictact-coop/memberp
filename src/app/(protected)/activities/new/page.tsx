import { prisma } from "@/lib/prisma";
import { ACTIVITY_OPERATIONS_ROLES, requireRole } from "@/lib/auth/roles";
import { MANAGEMENT_TYPE_LABELS, MISSION_LABELS, VISIBILITY_LABELS } from "@/lib/activity-labels";

const ERROR_MESSAGES: Record<string, string> = {
  invalid: "제목·목적·유형·책임자·미션(1개 이상)을 모두 입력하세요.",
  invalid_manager: "선택한 책임자 계정을 확인할 수 없습니다.",
  invalid_dates: "종료 예정일은 시작 예정일보다 빠를 수 없습니다.",
};

// 활동 등록 — FR-04. v0.1 A01: 유형·미션(1개 이상)·목적·책임자가 필수다.
// 상위 활동 지정, 예산 등은 아직 없다(다음 작업) — R1 FR-04 검수 기준(담당자·유형·
// 기간·공개범위·상태)에 맞춰 최소로 시작한다.
export default async function NewActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireRole(ACTIVITY_OPERATIONS_ROLES);
  const { error } = await searchParams;

  const accounts = await prisma.account.findMany({
    where: { status: "ACTIVE" },
    orderBy: { email: "asc" },
    include: { subject: { select: { name: true } } },
  });

  return (
    <section>
      <h1 style={{ fontSize: 20 }}>새 활동 등록</h1>
      {error && ERROR_MESSAGES[error] && (
        <p style={{ color: "var(--color-danger)" }}>{ERROR_MESSAGES[error]}</p>
      )}

      <form method="POST" action="/api/activities/create" className="card">
        <label htmlFor="title" style={{ display: "block", fontSize: 14, marginBottom: 4 }}>
          활동명
        </label>
        <input
          id="title"
          name="title"
          required
          style={{ width: "100%", padding: 10, fontSize: 16, marginBottom: 12 }}
        />

        <label htmlFor="managementType" style={{ display: "block", fontSize: 14, marginBottom: 4 }}>
          유형
        </label>
        <select
          id="managementType"
          name="managementType"
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
          style={{ width: "100%", padding: 10, fontSize: 16, marginBottom: 12 }}
        />

        <fieldset style={{ border: "1px solid #e0e0e0", padding: 10, marginBottom: 12 }}>
          <legend style={{ fontSize: 14 }}>미션 (1개 이상)</legend>
          {Object.entries(MISSION_LABELS).map(([value, label]) => (
            <label key={value} style={{ display: "block", fontSize: 14, padding: "4px 0" }}>
              <input type="checkbox" name="missions" value={value} /> {label}
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
          defaultValue="TEAM"
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
          style={{ width: "100%", padding: 10, fontSize: 16, marginBottom: 12 }}
        />

        <label htmlFor="plannedEndDate" style={{ display: "block", fontSize: 14, marginBottom: 4 }}>
          종료 예정일
        </label>
        <input
          id="plannedEndDate"
          name="plannedEndDate"
          type="date"
          style={{ width: "100%", padding: 10, fontSize: 16, marginBottom: 16 }}
        />

        <button type="submit" style={{ padding: "10px 16px", fontSize: 16 }}>
          등록
        </button>
      </form>
    </section>
  );
}
