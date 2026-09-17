import { requireActiveSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import {
  COMPENSATION_BASIS_LABELS,
  CONTRIBUTION_TYPE_LABELS,
} from "@/lib/contribution-labels";

const ERROR_MESSAGES: Record<string, string> = {
  forbidden: "담당 활동·수요의 기여만 확인할 수 있습니다.",
  self_confirm: "본인이 작성한 기여는 스스로 확인할 수 없습니다. 다른 확인자가 처리해야 합니다.",
};

// 담당자 확인함 — FR-07. "담당 범위"는 활동 책임자(Activity.managerAccountId) 또는
// 수요 담당자(Need.assigneeAccountId)로 판단한다 — 별도 역할 기반 접근 제어가 아직
// 없어(다음 작업) 이미 있는 소유권 필드를 재사용했다.
export default async function ReviewInboxPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const active = await requireActiveSession();
  const { error } = await searchParams;

  const contributions = await prisma.contribution.findMany({
    where: {
      status: "SUBMITTED",
      OR: [
        { activity: { managerAccountId: active.account.id } },
        { need: { assigneeAccountId: active.account.id } },
      ],
    },
    include: {
      activity: { select: { title: true } },
      need: { select: { title: true } },
      contributorSubject: { select: { name: true } },
    },
    orderBy: { submittedAt: "asc" },
  });

  return (
    <section>
      <h1 style={{ fontSize: 20 }}>담당자 확인함</h1>
      {error && ERROR_MESSAGES[error] && <p style={{ color: "#c0392b" }}>{ERROR_MESSAGES[error]}</p>}

      {contributions.length === 0 ? (
        <p style={{ color: "#555555" }}>확인 대기 중인 기여가 없습니다.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {contributions.map((contribution) => (
            <li key={contribution.id} style={{ borderBottom: "1px solid #e0e0e0", padding: "12px 0" }}>
              <div style={{ fontSize: 12, color: "#888888" }}>{contribution.displayId}</div>
              <div>
                {contribution.activity?.title ?? contribution.need?.title} ·{" "}
                {contribution.contributorSubject.name}
              </div>
              <div style={{ fontSize: 12, color: "#555555" }}>
                {CONTRIBUTION_TYPE_LABELS[contribution.contributionType]} ·{" "}
                {contribution.minutes != null ? `${contribution.minutes}분` : "시간 미상"} ·{" "}
                {COMPENSATION_BASIS_LABELS[contribution.compensationBasis]}
              </div>
              <p style={{ margin: "4px 0" }}>{contribution.description}</p>
              {contribution.revisionOfId && (
                <p style={{ fontSize: 12, color: "#888888" }}>
                  기존 확인 기록의 정정본입니다. 확인하면 이전 값을 대체합니다.
                </p>
              )}

              <div style={{ display: "flex", gap: 8 }}>
                <form method="POST" action={`/api/contributions/${contribution.id}/confirm`}>
                  <button type="submit" style={{ padding: "8px 14px", fontSize: 14 }}>
                    확인
                  </button>
                </form>
                <form
                  method="POST"
                  action={`/api/contributions/${contribution.id}/request-revision`}
                  style={{ display: "flex", gap: 4 }}
                >
                  <input
                    name="reason"
                    placeholder="보완 요청 사유"
                    style={{ padding: 8, fontSize: 14 }}
                  />
                  <button type="submit" style={{ padding: "8px 14px", fontSize: 14 }}>
                    보완 요청
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
