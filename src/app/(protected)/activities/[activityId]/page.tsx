import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireActiveSession } from "@/lib/auth/session";
import {
  ASSIGNMENT_ROLE_OPTIONS,
  ASSIGNMENT_STATUS_LABELS,
  REOPENABLE_ASSIGNMENT_STATUSES,
} from "@/lib/assignment-labels";
import { ACTIVITY_STATUS_BADGE_TONE, ACTIVITY_STATUS_LABELS, MISSION_LABELS } from "@/lib/activity-labels";
import {
  ACTIVITY_TRANSITION_LABELS,
  ACTIVITY_TRANSITION_REASON_LABELS,
  availableActivityTransitions,
} from "@/lib/activity-status";

export const dynamic = "force-dynamic";

const ERROR_MESSAGES: Record<string, string> = {
  invalid: "요청을 처리할 수 없습니다.",
  already_applied: "이미 신청했거나 참여 중인 활동입니다.",
  forbidden: "담당 활동의 신청만 처리할 수 있습니다.",
  invalid_transition: "지금 상태에서는 그 처리를 할 수 없습니다.",
  reason_required: "사유를 입력해야 합니다.",
  missing_planned_dates: "승인 요청 전에 시작·종료 예정일을 먼저 채워야 합니다.",
  locked: "종료·취소된 활동은 수정할 수 없습니다. 수정은 정정 이력으로 남겨야 합니다.",
};

// 활동 상세 — FR-04, FR-05(참여 신청·배치)
export default async function ActivityDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ activityId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const active = await requireActiveSession();
  const { activityId } = await params;
  const { error } = await searchParams;

  const activity = await prisma.activity.findUnique({
    where: { id: activityId },
    include: {
      assignments: {
        include: { subject: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!activity) {
    notFound();
  }

  const isManager = activity.managerAccountId === active.account.id;
  const myAssignment = active.account.subjectId
    ? activity.assignments.find((assignment) => assignment.subjectId === active.account.subjectId)
    : undefined;
  const canApply = !myAssignment || REOPENABLE_ASSIGNMENT_STATUSES.includes(myAssignment.status);

  const pendingForManager = activity.assignments.filter((assignment) => assignment.status === "PROPOSED");
  const rosterForManager = activity.assignments.filter(
    (assignment) => assignment.status === "ACCEPTED" || assignment.status === "IN_PROGRESS",
  );

  return (
    <section>
      <p style={{ fontSize: 12, color: "var(--color-text-muted)" }}>{activity.displayId}</p>
      <h1 style={{ fontSize: 20, marginBottom: 8 }}>{activity.title}</h1>

      <div className="card">
        <span className={`badge ${ACTIVITY_STATUS_BADGE_TONE[activity.status]}`}>
          {ACTIVITY_STATUS_LABELS[activity.status]}
        </span>
        <p style={{ color: "var(--color-text-muted)", margin: "10px 0" }}>{activity.purpose}</p>
        <dl style={{ margin: 0, fontSize: 13, color: "var(--color-text-muted)" }}>
          <dt style={{ display: "inline", fontWeight: 600, color: "var(--color-text)" }}>미션</dt>
          <dd style={{ display: "inline", margin: "0 0 0 6px" }}>
            {activity.missions.map((mission) => MISSION_LABELS[mission]).join(", ") || "미지정"}
          </dd>
          <br />
          <dt style={{ display: "inline", fontWeight: 600, color: "var(--color-text)" }}>참여 배정</dt>
          <dd style={{ display: "inline", margin: "0 0 0 6px" }}>{activity.assignments.length}건</dd>
          {activity.closeEvaluationNote && (
            <>
              <br />
              <dt style={{ display: "inline", fontWeight: 600, color: "var(--color-text)" }}>
                종료 평가
              </dt>
              <dd style={{ display: "inline", margin: "0 0 0 6px" }}>{activity.closeEvaluationNote}</dd>
            </>
          )}
        </dl>
        {isManager && activity.status !== "CLOSED" && activity.status !== "CANCELLED" && (
          <p style={{ marginBottom: 0 }}>
            <Link href={`/activities/${activity.id}/edit`} style={{ fontSize: 13, fontWeight: 600 }}>
              활동 정보 수정 →
            </Link>
          </p>
        )}
      </div>

      {error && ERROR_MESSAGES[error] && (
        <p style={{ color: "var(--color-danger)", marginTop: 12 }}>{ERROR_MESSAGES[error]}</p>
      )}

      {isManager && (
        <div style={{ marginTop: 16 }}>
          <h2 style={{ fontSize: 16 }}>상태 관리</h2>
          {availableActivityTransitions(activity.status).length === 0 ? (
            <p className="card" style={{ color: "var(--color-text-muted)" }}>
              {activity.status === "CLOSED"
                ? "종료된 활동입니다. 수정은 정정 이력으로 남겨야 합니다."
                : "취소된 활동입니다."}
            </p>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {availableActivityTransitions(activity.status).map((transitionAction) => {
                const reasonLabel = ACTIVITY_TRANSITION_REASON_LABELS[transitionAction];
                return (
                  <form
                    key={transitionAction}
                    method="POST"
                    action={`/api/activities/${activity.id}/transition`}
                    className="card"
                    style={{ padding: 12 }}
                  >
                    <input type="hidden" name="action" value={transitionAction} />
                    {reasonLabel && (
                      <>
                        <label
                          htmlFor={`reason-${transitionAction}`}
                          style={{ display: "block", fontSize: 12, marginBottom: 4 }}
                        >
                          {reasonLabel}
                        </label>
                        <textarea
                          id={`reason-${transitionAction}`}
                          name="reason"
                          required
                          rows={2}
                          style={{ width: 220, padding: 6, fontSize: 14, marginBottom: 6 }}
                        />
                      </>
                    )}
                    {transitionAction === "hold" && (
                      <>
                        <label
                          htmlFor="reviewDate"
                          style={{ display: "block", fontSize: 12, marginBottom: 4 }}
                        >
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
                    <button type="submit" style={{ padding: "8px 14px", fontSize: 14 }}>
                      {ACTIVITY_TRANSITION_LABELS[transitionAction]}
                    </button>
                  </form>
                );
              })}
            </div>
          )}
        </div>
      )}

      <h2 style={{ fontSize: 16, marginTop: 24 }}>내 참여</h2>
      {!active.account.subjectId ? (
        <p style={{ color: "var(--color-danger)" }}>계정에 연결된 사람 정보가 없어 신청할 수 없습니다.</p>
      ) : myAssignment && !canApply ? (
        <div className="card">
          <p style={{ margin: 0 }}>
            {ASSIGNMENT_STATUS_LABELS[myAssignment.status]} · 역할: {myAssignment.role}
          </p>
          {myAssignment.status === "PROPOSED" && (
            <form
              method="POST"
              action={`/api/activity-assignments/${myAssignment.id}/withdraw`}
              style={{ marginTop: 8 }}
            >
              <button type="submit" className="btn-outline" style={{ padding: "8px 14px", fontSize: 14 }}>
                신청 철회
              </button>
            </form>
          )}
        </div>
      ) : (
        <form method="POST" action="/api/activity-assignments/apply" className="card">
          <input type="hidden" name="activityId" value={activity.id} />
          <label htmlFor="role" style={{ display: "block", fontSize: 14, marginBottom: 4 }}>
            역할
          </label>
          <select
            id="role"
            name="role"
            defaultValue={ASSIGNMENT_ROLE_OPTIONS[0]}
            style={{ padding: 10, fontSize: 16, marginBottom: 12, marginRight: 8 }}
          >
            {ASSIGNMENT_ROLE_OPTIONS.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
          <button type="submit" style={{ padding: "10px 16px", fontSize: 16 }}>
            참여 신청
          </button>
        </form>
      )}

      {isManager && (
        <>
          <h2 style={{ fontSize: 16, marginTop: 24 }}>신청 대기 ({pendingForManager.length})</h2>
          {pendingForManager.length === 0 ? (
            <p style={{ color: "var(--color-text-muted)" }}>대기 중인 신청이 없습니다.</p>
          ) : (
            <ul className="card-list">
              {pendingForManager.map((assignment) => (
                <li key={assignment.id} className="card">
                  {assignment.subject.name} · {assignment.role}
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <form method="POST" action={`/api/activity-assignments/${assignment.id}/accept`}>
                      <button type="submit" style={{ padding: "6px 12px", fontSize: 14 }}>
                        수락
                      </button>
                    </form>
                    <form method="POST" action={`/api/activity-assignments/${assignment.id}/reject`}>
                      <button
                        type="submit"
                        className="btn-outline"
                        style={{ padding: "6px 12px", fontSize: 14 }}
                      >
                        거절
                      </button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <h2 style={{ fontSize: 16, marginTop: 24 }}>참여 중 ({rosterForManager.length})</h2>
          {rosterForManager.length === 0 ? (
            <p style={{ color: "var(--color-text-muted)" }}>참여 중인 사람이 없습니다.</p>
          ) : (
            <ul className="card-list">
              {rosterForManager.map((assignment) => (
                <li key={assignment.id} className="card">
                  {assignment.subject.name} · {assignment.role} · {ASSIGNMENT_STATUS_LABELS[assignment.status]}
                  <form method="POST" action={`/api/activity-assignments/${assignment.id}/end`}>
                    <button
                      type="submit"
                      className="btn-outline"
                      style={{ padding: "6px 12px", fontSize: 14, marginTop: 8 }}
                    >
                      종료 처리
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <p style={{ fontSize: 13, marginTop: 24 }}>
        <a href={`/my/contributions/new?activityId=${activity.id}`} style={{ fontWeight: 600 }}>
          기여 작성 →
        </a>
      </p>
    </section>
  );
}
