import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireActiveSession } from "@/lib/auth/session";
import { ASSIGNMENT_STATUS_BADGE_TONE, ASSIGNMENT_STATUS_LABELS } from "@/lib/assignment-labels";

export const dynamic = "force-dynamic";

// 내 홈 — v1.0 §6 "참여 중인 활동, 기록하기, 보완 요청, 최근 확인 결과"를 모아
// 보여준다. 역할별로 다른 홈을 보여주는 것은 아직 없다(문서화된 별도 과제) —
// 누구나 자신의 참여·기여 현황을 똑같은 구성으로 본다.
export default async function HomePage() {
  const active = await requireActiveSession();

  if (!active.account.subjectId) {
    return (
      <section>
        <h1 style={{ fontSize: 20 }}>내 홈</h1>
        <p style={{ color: "var(--color-danger)" }}>
          계정에 연결된 사람 정보가 없습니다. 사무국에 문의하세요.
        </p>
      </section>
    );
  }
  const subjectId = active.account.subjectId;

  const [activeAssignments, needsRevision, recentConfirmed] = await Promise.all([
    prisma.activityAssignment.findMany({
      where: { subjectId, status: { in: ["ACCEPTED", "IN_PROGRESS"] } },
      include: { activity: { select: { id: true, displayId: true, title: true } } },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.contribution.findMany({
      where: { contributorSubjectId: subjectId, status: "NEEDS_REVISION" },
      include: { activity: { select: { title: true } }, need: { select: { title: true } } },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.contribution.findMany({
      where: { contributorSubjectId: subjectId, status: "CONFIRMED" },
      include: { activity: { select: { title: true } }, need: { select: { title: true } } },
      orderBy: { confirmedAt: "desc" },
      take: 5,
    }),
  ]);

  return (
    <section>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>내 홈</h1>
      <p style={{ color: "var(--color-text-muted)", fontSize: 13, marginTop: 0 }}>
        참여 중인 활동과 기여 현황을 모아 봅니다.
      </p>

      <p>
        <Link href="/my/contributions/new" className="btn-link">
          오늘 기록하기
        </Link>
      </p>

      <h2 style={{ fontSize: 16, marginTop: 20 }}>참여 중인 활동 ({activeAssignments.length})</h2>
      {activeAssignments.length === 0 ? (
        <p className="card" style={{ color: "var(--color-text-muted)" }}>
          참여 중인 활동이 없습니다.{" "}
          <Link href="/activities" style={{ fontWeight: 600 }}>
            참여할 일 둘러보기 →
          </Link>
        </p>
      ) : (
        <ul className="card-list">
          {activeAssignments.map((assignment) => (
            <li key={assignment.id} className="card">
              <div style={{ fontWeight: 600 }}>
                <Link href={`/activities/${assignment.activity.id}`}>{assignment.activity.title}</Link>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginTop: 6,
                  fontSize: 12,
                  color: "var(--color-text-muted)",
                }}
              >
                <span>{assignment.activity.displayId}</span>
                <span className={`badge ${ASSIGNMENT_STATUS_BADGE_TONE[assignment.status]}`}>
                  {ASSIGNMENT_STATUS_LABELS[assignment.status]}
                </span>
                <span>역할: {assignment.role}</span>
              </div>
              <p style={{ marginBottom: 0, marginTop: 8 }}>
                <Link
                  href={`/my/contributions/new?activityId=${assignment.activity.id}`}
                  style={{ fontSize: 13, fontWeight: 600 }}
                >
                  이 활동으로 기록하기 →
                </Link>
              </p>
            </li>
          ))}
        </ul>
      )}

      <h2 style={{ fontSize: 16, marginTop: 20 }}>보완 요청 ({needsRevision.length})</h2>
      {needsRevision.length === 0 ? (
        <p className="card" style={{ color: "var(--color-text-muted)" }}>
          보완 요청된 기여가 없습니다.
        </p>
      ) : (
        <ul className="card-list">
          {needsRevision.map((contribution) => (
            <li key={contribution.id} className="card">
              <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                {contribution.displayId}
              </div>
              <div style={{ fontWeight: 600, margin: "2px 0" }}>
                {contribution.activity?.title ?? contribution.need?.title ?? "(연결 안 됨)"}
              </div>
              {contribution.revisionReason && (
                <div style={{ fontSize: 12, color: "var(--color-danger)" }}>
                  보완 요청: {contribution.revisionReason}
                </div>
              )}
              <p style={{ marginBottom: 0, marginTop: 8 }}>
                <Link
                  href={`/my/contributions/new?id=${contribution.id}`}
                  style={{ fontSize: 13, fontWeight: 600 }}
                >
                  보완해서 다시 제출 →
                </Link>
              </p>
            </li>
          ))}
        </ul>
      )}

      <h2 style={{ fontSize: 16, marginTop: 20 }}>최근 확인 결과</h2>
      {recentConfirmed.length === 0 ? (
        <p className="card" style={{ color: "var(--color-text-muted)" }}>
          아직 확인된 기여가 없습니다.
        </p>
      ) : (
        <ul className="card-list">
          {recentConfirmed.map((contribution) => (
            <li key={contribution.id} className="card">
              <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                {contribution.displayId}
                {contribution.confirmedAt &&
                  ` · ${contribution.confirmedAt.toISOString().slice(0, 10)} 확인`}
              </div>
              <div style={{ fontWeight: 600, margin: "2px 0" }}>
                {contribution.activity?.title ?? contribution.need?.title ?? "(연결 안 됨)"}
              </div>
              <div style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
                {contribution.description}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
