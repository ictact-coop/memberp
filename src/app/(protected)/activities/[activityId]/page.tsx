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
import { ATTACHMENT_MAX_SIZE_BYTES } from "@/lib/attachment-storage";

export const dynamic = "force-dynamic";

const ERROR_MESSAGES: Record<string, string> = {
  invalid: "요청을 처리할 수 없습니다.",
  already_applied: "이미 신청했거나 참여 중인 활동입니다.",
  forbidden: "담당 활동의 신청만 처리할 수 있습니다.",
  invalid_transition: "지금 상태에서는 그 처리를 할 수 없습니다.",
  reason_required: "사유를 입력해야 합니다.",
  missing_planned_dates: "승인 요청 전에 시작·종료 예정일을 먼저 채워야 합니다.",
  locked: "종료·취소된 활동은 수정할 수 없습니다. 수정은 정정 이력으로 남겨야 합니다.",
  not_locked: "진행 중인 활동은 정정 이력이 아니라 활동 정보 수정을 쓰세요.",
  already_revised: "이미 정정된 활동입니다. 최신 버전을 보여드립니다.",
  attachment_required: "첨부할 파일을 선택하세요.",
  attachment_too_large: `첨부파일은 ${Math.floor(ATTACHMENT_MAX_SIZE_BYTES / 1024 / 1024)}MB 이하만 가능합니다.`,
  attachment_type: "이미지(JPEG/PNG/WEBP/GIF) 또는 PDF만 첨부할 수 있습니다.",
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
      parentActivity: { select: { id: true, displayId: true, title: true } },
      childActivities: {
        where: { archivedAt: null },
        orderBy: { createdAt: "desc" },
        select: { id: true, displayId: true, title: true },
      },
      revisionOf: { select: { id: true, displayId: true, title: true } },
      revisions: { select: { id: true, displayId: true, title: true } },
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

  // 첨부는 책임자만 다룬다(다운로드 권한과 같은 원칙) — 목록 자체를 다른 사람에게는
  // 보여주지 않는다.
  const attachments = isManager
    ? await prisma.attachment.findMany({
        where: { entityType: "ACTIVITY", entityId: activity.id, deletedAt: null },
        orderBy: { uploadedAt: "desc" },
      })
    : [];
  const isLocked = activity.status === "CLOSED" || activity.status === "CANCELLED";
  const canEditAttachments = !isLocked;
  const supersededBy = activity.revisions[0];

  return (
    <section>
      <p style={{ fontSize: 12, color: "var(--color-text-muted)" }}>{activity.displayId}</p>
      <h1 style={{ fontSize: 20, marginBottom: 8 }}>{activity.title}</h1>

      {supersededBy && (
        <p className="notice-banner">
          이 활동 정보는 정정되었습니다.{" "}
          <Link href={`/activities/${supersededBy.id}`}>최신 버전({supersededBy.displayId}) 보기 →</Link>
        </p>
      )}
      {activity.revisionOf && (
        <p className="notice-banner">
          이 활동은{" "}
          <Link href={`/activities/${activity.revisionOf.id}`}>
            {activity.revisionOf.displayId} · {activity.revisionOf.title}
          </Link>
          의 정정본입니다.
        </p>
      )}
      {(supersededBy || activity.revisionOf) && (
        <p style={{ marginBottom: 16 }}>
          <Link href={`/activities/${activity.id}/lineage`} style={{ fontSize: 13, fontWeight: 600 }}>
            정정 계보 전체 보기 →
          </Link>
        </p>
      )}

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
          {activity.parentActivity && (
            <>
              <br />
              <dt style={{ display: "inline", fontWeight: 600, color: "var(--color-text)" }}>
                상위 활동
              </dt>
              <dd style={{ display: "inline", margin: "0 0 0 6px" }}>
                <Link href={`/activities/${activity.parentActivity.id}`}>
                  {activity.parentActivity.displayId} · {activity.parentActivity.title}
                </Link>
              </dd>
            </>
          )}
          {activity.budgetBaseline !== null && (
            <>
              <br />
              <dt style={{ display: "inline", fontWeight: 600, color: "var(--color-text)" }}>예산</dt>
              <dd style={{ display: "inline", margin: "0 0 0 6px" }}>
                {Number(activity.budgetBaseline).toLocaleString("ko-KR")}원
              </dd>
            </>
          )}
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
        {isManager && !isLocked && (
          <p style={{ marginBottom: 0 }}>
            <Link href={`/activities/${activity.id}/edit`} style={{ fontSize: 13, fontWeight: 600 }}>
              활동 정보 수정 →
            </Link>
          </p>
        )}
        {isManager && isLocked && !supersededBy && (
          <p style={{ marginBottom: 0 }}>
            <Link href={`/activities/${activity.id}/revise`} style={{ fontSize: 13, fontWeight: 600 }}>
              정정 이력 만들기 →
            </Link>
          </p>
        )}
        {isManager && (
          <p style={{ marginBottom: 0, marginTop: 6 }}>
            <Link
              href={`/my/audit-log?entityType=Activity&entityId=${activity.id}`}
              style={{ fontSize: 13, fontWeight: 600 }}
            >
              이 활동 변경 이력 →
            </Link>
          </p>
        )}
      </div>

      {activity.childActivities.length > 0 && (
        <>
          <h2 style={{ fontSize: 16, marginTop: 24 }}>하위 활동</h2>
          <ul className="card-list">
            {activity.childActivities.map((child) => (
              <li key={child.id} className="card" style={{ padding: 12 }}>
                <Link href={`/activities/${child.id}`} style={{ fontWeight: 600 }}>
                  {child.displayId} · {child.title}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      {isManager && (
        <>
          <h2 style={{ fontSize: 16, marginTop: 24 }}>첨부파일</h2>
          <div className="card">
            {attachments.length === 0 ? (
              <p style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 0 }}>
                아직 첨부한 파일이 없습니다.
              </p>
            ) : (
              <ul style={{ listStyle: "none", padding: 0 }}>
                {attachments.map((attachment) => (
                  <li key={attachment.id} style={{ fontSize: 14, marginBottom: 6 }}>
                    <a href={`/api/attachments/${attachment.id}/download`} style={{ fontWeight: 600 }}>
                      {attachment.fileName}
                    </a>{" "}
                    {canEditAttachments && (
                      <form
                        method="POST"
                        action={`/api/attachments/${attachment.id}/delete`}
                        style={{ display: "inline" }}
                      >
                        <button type="submit" className="btn-outline" style={{ fontSize: 12, padding: "2px 8px" }}>
                          삭제
                        </button>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {canEditAttachments && (
              <form
                method="POST"
                action={`/api/activities/${activity.id}/attachments`}
                encType="multipart/form-data"
                style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center" }}
              >
                <input
                  type="file"
                  name="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                />
                <button type="submit" style={{ padding: "6px 12px", fontSize: 14 }}>
                  첨부
                </button>
              </form>
            )}
          </div>
        </>
      )}

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
      {supersededBy ? (
        <p style={{ color: "var(--color-text-muted)" }}>
          정정된 활동입니다. 최신 버전에서 참여 현황을 확인하세요.
        </p>
      ) : !active.account.subjectId ? (
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

      {isManager && !supersededBy && (
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

      {!supersededBy && (
        <p style={{ fontSize: 13, marginTop: 24 }}>
          <a href={`/my/contributions/new?activityId=${activity.id}`} style={{ fontWeight: 600 }}>
            기여 작성 →
          </a>
        </p>
      )}
    </section>
  );
}
