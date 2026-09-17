import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireActiveSession } from "@/lib/auth/session";
import {
  ASSIGNMENT_ROLE_OPTIONS,
  ASSIGNMENT_STATUS_LABELS,
  REOPENABLE_ASSIGNMENT_STATUSES,
} from "@/lib/assignment-labels";
import { ACTIVITY_STATUS_LABELS, MISSION_LABELS } from "@/lib/activity-labels";

export const dynamic = "force-dynamic";

const ERROR_MESSAGES: Record<string, string> = {
  invalid: "요청을 처리할 수 없습니다.",
  already_applied: "이미 신청했거나 참여 중인 활동입니다.",
  forbidden: "담당 활동의 신청만 처리할 수 있습니다.",
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
      <p style={{ fontSize: 12, color: "#888888" }}>{activity.displayId}</p>
      <h1 style={{ fontSize: 20 }}>{activity.title}</h1>
      <p style={{ color: "#555555" }}>{activity.purpose}</p>
      <dl>
        <dt>상태</dt>
        <dd>{ACTIVITY_STATUS_LABELS[activity.status]}</dd>
        <dt>미션</dt>
        <dd>{activity.missions.map((mission) => MISSION_LABELS[mission]).join(", ") || "미지정"}</dd>
        <dt>참여 배정</dt>
        <dd>{activity.assignments.length}건</dd>
      </dl>

      {error && ERROR_MESSAGES[error] && <p style={{ color: "#c0392b" }}>{ERROR_MESSAGES[error]}</p>}

      <h2 style={{ fontSize: 16 }}>내 참여</h2>
      {!active.account.subjectId ? (
        <p style={{ color: "#c0392b" }}>계정에 연결된 사람 정보가 없어 신청할 수 없습니다.</p>
      ) : myAssignment && !canApply ? (
        <div>
          <p>
            {ASSIGNMENT_STATUS_LABELS[myAssignment.status]} · 역할: {myAssignment.role}
          </p>
          {myAssignment.status === "PROPOSED" && (
            <form method="POST" action={`/api/activity-assignments/${myAssignment.id}/withdraw`}>
              <button type="submit" style={{ padding: "8px 14px", fontSize: 14 }}>
                신청 철회
              </button>
            </form>
          )}
        </div>
      ) : (
        <form method="POST" action="/api/activity-assignments/apply">
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
            <p style={{ color: "#555555" }}>대기 중인 신청이 없습니다.</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0 }}>
              {pendingForManager.map((assignment) => (
                <li key={assignment.id} style={{ borderBottom: "1px solid #e0e0e0", padding: "8px 0" }}>
                  {assignment.subject.name} · {assignment.role}
                  <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                    <form method="POST" action={`/api/activity-assignments/${assignment.id}/accept`}>
                      <button type="submit" style={{ padding: "6px 12px", fontSize: 14 }}>
                        수락
                      </button>
                    </form>
                    <form method="POST" action={`/api/activity-assignments/${assignment.id}/reject`}>
                      <button type="submit" style={{ padding: "6px 12px", fontSize: 14 }}>
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
            <p style={{ color: "#555555" }}>참여 중인 사람이 없습니다.</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0 }}>
              {rosterForManager.map((assignment) => (
                <li key={assignment.id} style={{ borderBottom: "1px solid #e0e0e0", padding: "8px 0" }}>
                  {assignment.subject.name} · {assignment.role} · {ASSIGNMENT_STATUS_LABELS[assignment.status]}
                  <form method="POST" action={`/api/activity-assignments/${assignment.id}/end`}>
                    <button type="submit" style={{ padding: "6px 12px", fontSize: 14, marginTop: 4 }}>
                      종료 처리
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <p style={{ fontSize: 12, color: "#aaaaaa", marginTop: 24 }}>
        <a href={`/my/contributions/new?activityId=${activity.id}`}>기여 작성 →</a>
      </p>
    </section>
  );
}
