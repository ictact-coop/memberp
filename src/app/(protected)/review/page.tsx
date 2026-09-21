import { redirect } from "next/navigation";
import { requireActiveSession } from "@/lib/auth/session";
import { canAccessReviewInbox } from "@/lib/auth/roles";
import { prisma } from "@/lib/prisma";
import {
  COMPENSATION_BASIS_LABELS,
  CONTRIBUTION_TYPE_LABELS,
} from "@/lib/contribution-labels";

const ERROR_MESSAGES: Record<string, string> = {
  forbidden: "담당 활동·수요의 기여만 확인할 수 있습니다.",
  self_confirm: "본인이 작성한 기여는 스스로 확인할 수 없습니다. 다른 확인자가 처리해야 합니다.",
};

// 담당자 확인함 — FR-07. 이 화면 자체는 역할(ACTIVITY_MANAGER 등)이 있거나 실제로
// 활동·수요의 담당자로 지정된 계정만 들어올 수 있다(canAccessReviewInbox). 어떤
// 항목을 볼 수 있는지는 그 아래에서 여전히 소유권(managerAccountId 등)으로 좁힌다 —
// 역할이 있어도 남의 활동 제출물은 보이지 않는다.
export default async function ReviewInboxPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const active = await requireActiveSession();
  if (!(await canAccessReviewInbox(active.account.id))) {
    redirect("/forbidden");
  }
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
      attachments: { where: { deletedAt: null } },
    },
    orderBy: { submittedAt: "asc" },
  });

  return (
    <section>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>담당자 확인함</h1>
      <p style={{ color: "var(--color-text-muted)", fontSize: 13, marginTop: 0 }}>
        내가 담당하는 활동·상담의 확인 대기 기여입니다.
      </p>
      {error && ERROR_MESSAGES[error] && (
        <p style={{ color: "var(--color-danger)" }}>{ERROR_MESSAGES[error]}</p>
      )}

      {contributions.length === 0 ? (
        <p className="card" style={{ color: "var(--color-text-muted)" }}>
          확인 대기 중인 기여가 없습니다.
        </p>
      ) : (
        <ul className="card-list">
          {contributions.map((contribution) => (
            <li key={contribution.id} className="card">
              <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                {contribution.displayId}
              </div>
              <div style={{ fontWeight: 600, margin: "2px 0" }}>
                {contribution.activity?.title ?? contribution.need?.title} ·{" "}
                {contribution.contributorSubject.name}
              </div>
              <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                {CONTRIBUTION_TYPE_LABELS[contribution.contributionType]} ·{" "}
                {contribution.minutes != null ? `${contribution.minutes}분` : "시간 미상"} ·{" "}
                {COMPENSATION_BASIS_LABELS[contribution.compensationBasis]}
              </div>
              <p style={{ margin: "8px 0" }}>{contribution.description}</p>
              {contribution.revisionOfId && (
                <p style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                  기존 확인 기록의 정정본입니다. 확인하면 이전 값을 대체합니다.
                </p>
              )}
              {contribution.attachments.length > 0 && (
                <p style={{ fontSize: 12 }}>
                  증빙:{" "}
                  {contribution.attachments.map((attachment, index) => (
                    <span key={attachment.id}>
                      {index > 0 && ", "}
                      <a href={`/api/attachments/${attachment.id}/download`}>{attachment.fileName}</a>
                    </span>
                  ))}
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
                  <button type="submit" className="btn-outline" style={{ padding: "8px 14px", fontSize: 14 }}>
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
