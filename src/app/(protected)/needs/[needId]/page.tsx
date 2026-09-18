import { notFound } from "next/navigation";
import Link from "next/link";
import { NeedCloseType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireActiveSession } from "@/lib/auth/session";
import {
  NEED_CHANNEL_LABELS,
  NEED_CLOSE_TYPE_LABELS,
  NEED_STATUS_BADGE_TONE,
  NEED_STATUS_LABELS,
} from "@/lib/need-labels";
import { NEED_TRANSITION_LABELS, availableNeedTransitions } from "@/lib/need-status";

export const dynamic = "force-dynamic";

const ERROR_MESSAGES: Record<string, string> = {
  forbidden: "담당 상담·수요만 처리할 수 있습니다.",
  invalid_transition: "지금 상태에서는 그 처리를 할 수 없습니다.",
  reason_required: "사유를 입력해야 합니다.",
  missing_next_action_date: "다음 행동일을 먼저 채워야 합니다.",
  missing_proposal_fields: "대상(수혜)과 다음 행동(대안)을 먼저 채워야 합니다.",
  missing_activity: "연결할 활동을 선택해야 합니다.",
  invalid_activity: "선택한 활동을 확인할 수 없습니다.",
  invalid_beneficiary: "선택한 대상을 확인할 수 없습니다.",
  invalid_close_type: "종결 유형을 선택해야 합니다.",
};

// 상담·수요 상세 — FR-08. v0.1 §3.1 상태 전이를 담당자(assigneeAccountId)만 처리한다
// (활동 상태 전이와 같은 원칙).
export default async function NeedDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ needId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const active = await requireActiveSession();
  const { needId } = await params;
  const { error } = await searchParams;

  const need = await prisma.need.findUnique({
    where: { id: needId },
    include: {
      raisedBySubject: { select: { name: true } },
      beneficiarySubject: { select: { name: true } },
      activityLinks: { include: { activity: { select: { displayId: true, title: true } } } },
      _count: { select: { contributions: true } },
    },
  });
  if (!need) {
    notFound();
  }

  const isAssignee = need.assigneeAccountId === active.account.id;
  const actions = availableNeedTransitions(need.status);

  const [activities, subjects] = await Promise.all([
    actions.includes("convert")
      ? prisma.activity.findMany({
          where: { archivedAt: null },
          orderBy: { createdAt: "desc" },
          select: { id: true, displayId: true, title: true },
        })
      : Promise.resolve([]),
    actions.includes("propose") && !need.beneficiarySubjectId
      ? prisma.subject.findMany({
          where: { archivedAt: null },
          orderBy: { name: "asc" },
          take: 200,
          select: { id: true, displayId: true, name: true },
        })
      : Promise.resolve([]),
  ]);

  return (
    <section>
      <p style={{ fontSize: 12, color: "var(--color-text-muted)" }}>{need.displayId}</p>
      <h1 style={{ fontSize: 20, marginBottom: 8 }}>{need.title}</h1>

      <div className="card">
        <span className={`badge ${NEED_STATUS_BADGE_TONE[need.status]}`}>
          {NEED_STATUS_LABELS[need.status]}
        </span>
        <p style={{ color: "var(--color-text-muted)", margin: "10px 0" }}>{need.content}</p>
        <dl style={{ margin: 0, fontSize: 13, color: "var(--color-text-muted)", lineHeight: 1.9 }}>
          <dt style={{ display: "inline", fontWeight: 600, color: "var(--color-text)" }}>접수 경로</dt>
          <dd style={{ display: "inline", margin: "0 0 0 6px" }}>{NEED_CHANNEL_LABELS[need.channel]}</dd>
          <br />
          <dt style={{ display: "inline", fontWeight: 600, color: "var(--color-text)" }}>접수일</dt>
          <dd style={{ display: "inline", margin: "0 0 0 6px" }}>
            {need.receivedAt.toISOString().slice(0, 10)}
          </dd>
          {need.raisedBySubject && (
            <>
              <br />
              <dt style={{ display: "inline", fontWeight: 600, color: "var(--color-text)" }}>
                제기한 사람·단체
              </dt>
              <dd style={{ display: "inline", margin: "0 0 0 6px" }}>{need.raisedBySubject.name}</dd>
            </>
          )}
          {need.beneficiarySubject && (
            <>
              <br />
              <dt style={{ display: "inline", fontWeight: 600, color: "var(--color-text)" }}>
                대상(수혜) 사람·단체
              </dt>
              <dd style={{ display: "inline", margin: "0 0 0 6px" }}>{need.beneficiarySubject.name}</dd>
            </>
          )}
          {need.nextAction && (
            <>
              <br />
              <dt style={{ display: "inline", fontWeight: 600, color: "var(--color-text)" }}>
                다음 행동(대안)
              </dt>
              <dd style={{ display: "inline", margin: "0 0 0 6px" }}>{need.nextAction}</dd>
            </>
          )}
          {need.nextActionDate && (
            <>
              <br />
              <dt style={{ display: "inline", fontWeight: 600, color: "var(--color-text)" }}>
                다음 행동일
              </dt>
              <dd style={{ display: "inline", margin: "0 0 0 6px" }}>
                {need.nextActionDate.toISOString().slice(0, 10)}
              </dd>
            </>
          )}
          {need.closeType && (
            <>
              <br />
              <dt style={{ display: "inline", fontWeight: 600, color: "var(--color-text)" }}>
                종결 유형
              </dt>
              <dd style={{ display: "inline", margin: "0 0 0 6px" }}>
                {NEED_CLOSE_TYPE_LABELS[need.closeType]}
              </dd>
            </>
          )}
          {need.closeReason && (
            <>
              <br />
              <dt style={{ display: "inline", fontWeight: 600, color: "var(--color-text)" }}>
                종결 사유
              </dt>
              <dd style={{ display: "inline", margin: "0 0 0 6px" }}>{need.closeReason}</dd>
            </>
          )}
          <br />
          <dt style={{ display: "inline", fontWeight: 600, color: "var(--color-text)" }}>관련 기여</dt>
          <dd style={{ display: "inline", margin: "0 0 0 6px" }}>{need._count.contributions}건</dd>
        </dl>
      </div>

      {need.activityLinks.length > 0 && (
        <>
          <h2 style={{ fontSize: 16, marginTop: 24 }}>연결된 활동</h2>
          <ul className="card-list">
            {need.activityLinks.map((link) => (
              <li key={link.id} className="card" style={{ padding: 12 }}>
                <Link href={`/activities/${link.activityId}`} style={{ fontWeight: 600 }}>
                  {link.activity.displayId} · {link.activity.title}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      {error && ERROR_MESSAGES[error] && (
        <p style={{ color: "var(--color-danger)", marginTop: 12 }}>{ERROR_MESSAGES[error]}</p>
      )}

      {isAssignee && (
        <div style={{ marginTop: 16 }}>
          <h2 style={{ fontSize: 16 }}>상태 관리</h2>
          {actions.length === 0 ? (
            <p className="card" style={{ color: "var(--color-text-muted)" }}>
              {need.status === "CONVERTED" ? "사업화되어 더 진행할 처리가 없습니다." : "종결된 상담·수요입니다."}
            </p>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {actions.map((action) => (
                <form
                  key={action}
                  method="POST"
                  action={`/api/needs/${need.id}/transition`}
                  className="card"
                  style={{ padding: 12 }}
                >
                  <input type="hidden" name="action" value={action} />

                  {action === "review" && !need.nextActionDate && (
                    <>
                      <label
                        htmlFor="nextActionDate"
                        style={{ display: "block", fontSize: 12, marginBottom: 4 }}
                      >
                        다음 행동일
                      </label>
                      <input
                        id="nextActionDate"
                        name="nextActionDate"
                        type="date"
                        required
                        style={{ width: 200, padding: 6, fontSize: 14, marginBottom: 6 }}
                      />
                    </>
                  )}

                  {action === "propose" && !need.beneficiarySubjectId && (
                    <>
                      <label
                        htmlFor="beneficiarySubjectId"
                        style={{ display: "block", fontSize: 12, marginBottom: 4 }}
                      >
                        대상(수혜) 사람·단체
                      </label>
                      <select
                        id="beneficiarySubjectId"
                        name="beneficiarySubjectId"
                        required
                        style={{ width: 220, padding: 6, fontSize: 14, marginBottom: 6 }}
                      >
                        {subjects.map((subject) => (
                          <option key={subject.id} value={subject.id}>
                            {subject.displayId} · {subject.name}
                          </option>
                        ))}
                      </select>
                    </>
                  )}
                  {action === "propose" && !need.nextAction && (
                    <>
                      <label htmlFor="nextAction" style={{ display: "block", fontSize: 12, marginBottom: 4 }}>
                        다음 행동(대안)
                      </label>
                      <input
                        id="nextAction"
                        name="nextAction"
                        required
                        style={{ width: 220, padding: 6, fontSize: 14, marginBottom: 6 }}
                      />
                    </>
                  )}

                  {action === "convert" && (
                    <>
                      <label htmlFor="activityId" style={{ display: "block", fontSize: 12, marginBottom: 4 }}>
                        연결할 활동
                      </label>
                      <select
                        id="activityId"
                        name="activityId"
                        required
                        style={{ width: 220, padding: 6, fontSize: 14, marginBottom: 6 }}
                      >
                        {activities.map((activity) => (
                          <option key={activity.id} value={activity.id}>
                            {activity.displayId} · {activity.title}
                          </option>
                        ))}
                      </select>
                    </>
                  )}

                  {action === "hold" && (
                    <>
                      <label htmlFor="reason-hold" style={{ display: "block", fontSize: 12, marginBottom: 4 }}>
                        보류 사유
                      </label>
                      <textarea
                        id="reason-hold"
                        name="reason"
                        required
                        rows={2}
                        style={{ width: 220, padding: 6, fontSize: 14, marginBottom: 6 }}
                      />
                      <label htmlFor="reviewDate" style={{ display: "block", fontSize: 12, marginBottom: 4 }}>
                        재검토일 (선택)
                      </label>
                      <input
                        id="reviewDate"
                        name="reviewDate"
                        type="date"
                        style={{ width: 220, padding: 6, fontSize: 14, marginBottom: 6 }}
                      />
                    </>
                  )}

                  {action === "close" && (
                    <>
                      <label htmlFor="closeType" style={{ display: "block", fontSize: 12, marginBottom: 4 }}>
                        종결 유형
                      </label>
                      <select
                        id="closeType"
                        name="closeType"
                        required
                        style={{ width: 220, padding: 6, fontSize: 14, marginBottom: 6 }}
                      >
                        {Object.values(NeedCloseType).map((value) => (
                          <option key={value} value={value}>
                            {NEED_CLOSE_TYPE_LABELS[value]}
                          </option>
                        ))}
                      </select>
                      <label htmlFor="reason-close" style={{ display: "block", fontSize: 12, marginBottom: 4 }}>
                        종결 사유
                      </label>
                      <textarea
                        id="reason-close"
                        name="reason"
                        required
                        rows={2}
                        style={{ width: 220, padding: 6, fontSize: 14, marginBottom: 6 }}
                      />
                    </>
                  )}

                  <button type="submit" style={{ padding: "8px 14px", fontSize: 14 }}>
                    {NEED_TRANSITION_LABELS[action]}
                  </button>
                </form>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
