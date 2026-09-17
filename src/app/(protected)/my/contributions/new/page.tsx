import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireActiveSession } from "@/lib/auth/session";
import { generateToken } from "@/lib/auth/crypto";
import { CONTRIBUTION_TYPE_LABELS, COMPENSATION_BASIS_LABELS } from "@/lib/contribution-labels";

const ERROR_MESSAGES: Record<string, string> = {
  no_subject: "계정에 연결된 사람 정보가 없습니다. 사무국에 문의하세요.",
  invalid: "요청을 처리할 수 없습니다. 다시 시도하세요.",
  forbidden: "본인이 작성한 기여만 수정할 수 있습니다.",
  target_required: "제출하려면 활동 또는 상담·수요를 선택해야 합니다.",
  description_required: "제출하려면 한 일을 입력해야 합니다.",
  invalid_minutes: "시간은 0 이상의 숫자여야 합니다.",
};

function todayInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// 기여 작성 = "기록하기" (FR-06). 세 가지 진입 경로를 한 화면에서 처리한다:
// 1) 새로 작성 2) ?id=로 임시저장·보완요청 상태를 이어 작성 3) ?reviseOf=로 확인된
// 기여의 새 버전을 시작(BR-03) — 각각 initial 값만 다르고 폼·제출 로직은 동일하다.
export default async function NewContributionPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; reviseOf?: string; activityId?: string; error?: string }>;
}) {
  const active = await requireActiveSession();
  const { id, reviseOf, activityId, error } = await searchParams;

  if (!active.account.subjectId) {
    return (
      <section>
        <h1 style={{ fontSize: 20 }}>기록하기</h1>
        <p style={{ color: "#c0392b" }}>{ERROR_MESSAGES.no_subject}</p>
      </section>
    );
  }
  const subjectId = active.account.subjectId;

  let heading = "오늘 한 일을 남겨주세요";
  let initial = {
    contributionId: null as string | null,
    submissionKey: generateToken(),
    revisionOfId: null as string | null,
    // /my/participation의 "이 활동으로 기록하기" 링크에서 넘어온 경우 미리 선택해둔다.
    target: activityId ? `activity:${activityId}` : "",
    performedDate: todayInputValue(new Date()),
    contributionType: "TIME",
    minutes: "",
    compensationBasis: "UNCONFIRMED",
    description: "",
  };

  if (id) {
    const existing = await prisma.contribution.findUnique({ where: { id } });
    if (!existing || existing.contributorSubjectId !== subjectId) notFound();
    if (existing.status !== "DRAFT" && existing.status !== "NEEDS_REVISION") {
      redirect("/my/contributions");
    }
    heading = existing.status === "NEEDS_REVISION" ? "보완해서 다시 제출하세요" : "이어 작성하기";
    initial = {
      contributionId: existing.id,
      submissionKey: existing.submissionKey,
      revisionOfId: existing.revisionOfId,
      target: existing.activityId
        ? `activity:${existing.activityId}`
        : existing.needId
          ? `need:${existing.needId}`
          : "",
      performedDate: todayInputValue(existing.performedDate),
      contributionType: existing.contributionType,
      minutes: existing.minutes?.toString() ?? "",
      compensationBasis: existing.compensationBasis,
      description: existing.description ?? "",
    };
  } else if (reviseOf) {
    const original = await prisma.contribution.findUnique({ where: { id: reviseOf } });
    if (!original || original.contributorSubjectId !== subjectId || original.status !== "CONFIRMED") {
      notFound();
    }
    heading = "정정할 내용을 입력하세요";
    initial = {
      contributionId: null,
      submissionKey: generateToken(),
      revisionOfId: original.id,
      target: original.activityId
        ? `activity:${original.activityId}`
        : original.needId
          ? `need:${original.needId}`
          : "",
      performedDate: todayInputValue(original.performedDate),
      contributionType: original.contributionType,
      minutes: original.minutes?.toString() ?? "",
      compensationBasis: original.compensationBasis,
      description: original.description ?? "",
    };
  }

  const [activities, needs] = await Promise.all([
    prisma.activity.findMany({
      where: { archivedAt: null },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, title: true },
    }),
    prisma.need.findMany({
      where: { archivedAt: null },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, title: true },
    }),
  ]);

  return (
    <section>
      <h1 style={{ fontSize: 20 }}>{heading}</h1>
      {error && ERROR_MESSAGES[error] && <p style={{ color: "#c0392b" }}>{ERROR_MESSAGES[error]}</p>}
      {initial.revisionOfId && (
        <p style={{ fontSize: 12, color: "#888888" }}>
          확인된 기존 기록을 정정하는 새 버전입니다. 제출해 확인되면 이전 값을 대체합니다.
        </p>
      )}

      <form method="POST" action="/api/contributions/save">
        <input type="hidden" name="submissionKey" value={initial.submissionKey} />
        {initial.revisionOfId && (
          <input type="hidden" name="revisionOfId" value={initial.revisionOfId} />
        )}

        <label htmlFor="target" style={{ display: "block", fontSize: 14, marginBottom: 4 }}>
          활동 또는 상담·수요
        </label>
        <select
          id="target"
          name="target"
          defaultValue={initial.target}
          style={{ width: "100%", padding: 10, fontSize: 16, marginBottom: 12 }}
        >
          <option value="">선택 안 함 (임시저장만 가능)</option>
          {activities.map((activity) => (
            <option key={activity.id} value={`activity:${activity.id}`}>
              [활동] {activity.title}
            </option>
          ))}
          {needs.map((need) => (
            <option key={need.id} value={`need:${need.id}`}>
              [상담] {need.title}
            </option>
          ))}
        </select>

        <label htmlFor="performedDate" style={{ display: "block", fontSize: 14, marginBottom: 4 }}>
          날짜
        </label>
        <input
          id="performedDate"
          name="performedDate"
          type="date"
          defaultValue={initial.performedDate}
          style={{ width: "100%", padding: 10, fontSize: 16, marginBottom: 12 }}
        />

        <label htmlFor="description" style={{ display: "block", fontSize: 14, marginBottom: 4 }}>
          한 일
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          defaultValue={initial.description}
          style={{ width: "100%", padding: 10, fontSize: 16, marginBottom: 12 }}
        />

        <label htmlFor="contributionType" style={{ display: "block", fontSize: 14, marginBottom: 4 }}>
          기여 유형
        </label>
        <select
          id="contributionType"
          name="contributionType"
          defaultValue={initial.contributionType}
          style={{ width: "100%", padding: 10, fontSize: 16, marginBottom: 12 }}
        >
          {Object.entries(CONTRIBUTION_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        <label htmlFor="minutes" style={{ display: "block", fontSize: 14, marginBottom: 4 }}>
          시간(분) — 모르면 비워두세요
        </label>
        <input
          id="minutes"
          name="minutes"
          type="number"
          min={0}
          inputMode="numeric"
          defaultValue={initial.minutes}
          style={{ width: "100%", padding: 10, fontSize: 16, marginBottom: 12 }}
        />

        <label htmlFor="compensationBasis" style={{ display: "block", fontSize: 14, marginBottom: 4 }}>
          유·무급
        </label>
        <select
          id="compensationBasis"
          name="compensationBasis"
          defaultValue={initial.compensationBasis}
          style={{ width: "100%", padding: 10, fontSize: 16, marginBottom: 16 }}
        >
          {Object.entries(COMPENSATION_BASIS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="submit"
            name="intent"
            value="draft"
            style={{ flex: 1, padding: "10px 16px", fontSize: 16 }}
          >
            임시저장
          </button>
          <button
            type="submit"
            name="intent"
            value="submit"
            style={{ flex: 1, padding: "10px 16px", fontSize: 16, fontWeight: 700 }}
          >
            제출
          </button>
        </div>
      </form>
    </section>
  );
}
