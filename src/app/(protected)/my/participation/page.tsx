import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireActiveSession } from "@/lib/auth/session";
import { ASSIGNMENT_STATUS_BADGE_TONE, ASSIGNMENT_STATUS_LABELS } from "@/lib/assignment-labels";

const ERROR_MESSAGES: Record<string, string> = {
  no_subject: "계정에 연결된 사람 정보가 없습니다. 사무국에 문의하세요.",
  forbidden: "본인의 신청·배정만 처리할 수 있습니다.",
};

// 내 참여 — FR-05. 신청·배치 상태와 활동별 기록 진입점을 보여준다.
export default async function MyParticipationPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const active = await requireActiveSession();
  const { error } = await searchParams;

  if (!active.account.subjectId) {
    return (
      <section>
        <h1 style={{ fontSize: 20 }}>내 참여</h1>
        <p style={{ color: "var(--color-danger)" }}>{ERROR_MESSAGES.no_subject}</p>
      </section>
    );
  }

  const assignments = await prisma.activityAssignment.findMany({
    where: { subjectId: active.account.subjectId },
    include: { activity: { select: { id: true, displayId: true, title: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <section>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>내 참여</h1>
      {error && ERROR_MESSAGES[error] && (
        <p style={{ color: "var(--color-danger)" }}>{ERROR_MESSAGES[error]}</p>
      )}
      <p style={{ marginTop: 4 }}>
        <Link href="/activities" style={{ fontWeight: 600 }}>
          참여할 일 둘러보기 →
        </Link>
      </p>

      {assignments.length === 0 ? (
        <p className="card" style={{ color: "var(--color-text-muted)" }}>
          아직 신청한 활동이 없습니다.
        </p>
      ) : (
        <ul className="card-list">
          {assignments.map((assignment) => (
            <li key={assignment.id} className="card">
              <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                {assignment.activity.displayId}
              </div>
              <div style={{ fontWeight: 600, margin: "2px 0" }}>
                <Link href={`/activities/${assignment.activity.id}`}>{assignment.activity.title}</Link>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 12,
                  color: "var(--color-text-muted)",
                }}
              >
                <span className={`badge ${ASSIGNMENT_STATUS_BADGE_TONE[assignment.status]}`}>
                  {ASSIGNMENT_STATUS_LABELS[assignment.status]}
                </span>
                <span>역할: {assignment.role}</span>
              </div>
              <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 8 }}>
                {assignment.status === "PROPOSED" && (
                  <form method="POST" action={`/api/activity-assignments/${assignment.id}/withdraw`}>
                    <button type="submit" className="btn-outline" style={{ fontSize: 12, padding: "4px 10px" }}>
                      신청 철회
                    </button>
                  </form>
                )}
                {assignment.status === "ACCEPTED" && (
                  <form method="POST" action={`/api/activity-assignments/${assignment.id}/start`}>
                    <button type="submit" style={{ fontSize: 12, padding: "4px 10px" }}>
                      진행 시작
                    </button>
                  </form>
                )}
                {(assignment.status === "ACCEPTED" || assignment.status === "IN_PROGRESS") && (
                  <Link
                    href={`/my/contributions/new?activityId=${assignment.activity.id}`}
                    style={{ fontSize: 12, fontWeight: 600 }}
                  >
                    이 활동으로 기록하기 →
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
