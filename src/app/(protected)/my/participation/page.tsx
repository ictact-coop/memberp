import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireActiveSession } from "@/lib/auth/session";
import { ASSIGNMENT_STATUS_LABELS } from "@/lib/assignment-labels";

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
        <p style={{ color: "#c0392b" }}>{ERROR_MESSAGES.no_subject}</p>
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
      <h1 style={{ fontSize: 20 }}>내 참여</h1>
      {error && ERROR_MESSAGES[error] && <p style={{ color: "#c0392b" }}>{ERROR_MESSAGES[error]}</p>}
      <p>
        <Link href="/activities">참여할 일 둘러보기 →</Link>
      </p>

      {assignments.length === 0 ? (
        <p style={{ color: "#555555" }}>아직 신청한 활동이 없습니다.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {assignments.map((assignment) => (
            <li key={assignment.id} style={{ borderBottom: "1px solid #e0e0e0", padding: "12px 0" }}>
              <div style={{ fontSize: 12, color: "#888888" }}>{assignment.activity.displayId}</div>
              <div>
                <Link href={`/activities/${assignment.activity.id}`}>{assignment.activity.title}</Link>
              </div>
              <div style={{ fontSize: 12, color: "#555555" }}>
                {ASSIGNMENT_STATUS_LABELS[assignment.status]} · 역할: {assignment.role}
              </div>
              {assignment.status === "PROPOSED" && (
                <form method="POST" action={`/api/activity-assignments/${assignment.id}/withdraw`}>
                  <button type="submit" style={{ fontSize: 12, padding: "4px 10px", marginTop: 4 }}>
                    신청 철회
                  </button>
                </form>
              )}
              {assignment.status === "ACCEPTED" && (
                <form method="POST" action={`/api/activity-assignments/${assignment.id}/start`}>
                  <button type="submit" style={{ fontSize: 12, padding: "4px 10px", marginTop: 4 }}>
                    진행 시작
                  </button>
                </form>
              )}
              {(assignment.status === "ACCEPTED" || assignment.status === "IN_PROGRESS") && (
                <Link
                  href={`/my/contributions/new?activityId=${assignment.activity.id}`}
                  style={{ fontSize: 12, display: "inline-block", marginTop: 4 }}
                >
                  이 활동으로 기록하기 →
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
