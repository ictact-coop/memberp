import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireActiveSession } from "@/lib/auth/session";
import { canAccessReviewInbox, hasAnyRole } from "@/lib/auth/roles";
import { ASSIGNMENT_STATUS_BADGE_TONE, ASSIGNMENT_STATUS_LABELS } from "@/lib/assignment-labels";

export const dynamic = "force-dynamic";

// 내 홈 — v1.0 §6 "참여 중인 활동, 기록하기, 보완 요청, 최근 확인 결과"를 모아
// 보여준다. 안 읽은 알림(FR-10)이 있으면 맨 위에 배너로 알린다.
//
// 역할별 화면 커스터마이징(v0.1 §4.2/4.5): 조합원 기본 구성은 누구나 똑같이
// 보되, 담당자 확인 자격(canAccessReviewInbox — 역할이 있거나 실제 담당 활동·
// 상담이 있는 경우)이 있으면 "담당자로서 처리할 일" 섹션을, SECRETARIAT·
// SYSTEM_ADMIN 역할이 있으면 "운영 현황" 섹션을 위에 추가로 얹는다. v0.1이
// 그리는 사업 책임자·사무국 홈의 전체 구성(예산·청구·성과 탭 등)은 계약·청구·
// 지표 같은 R2 데이터 모델이 아직 없어 그대로 옮기지 못했고, 이미 있는 화면
// (/review, /admin/invitations, /needs)으로 이어주는 요약 카드로 좁혔다.
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
  const accountId = active.account.id;

  const [isReviewer, isAdmin] = await Promise.all([
    canAccessReviewInbox(accountId),
    hasAnyRole(accountId, ["SECRETARIAT", "SYSTEM_ADMIN"]),
  ]);

  const [
    unreadNotificationCount,
    activeAssignments,
    needsRevision,
    recentConfirmed,
    pendingContributions,
    pendingAssignments,
    pendingOwnNeeds,
    pendingInvitations,
    unreviewedNeeds,
  ] = await Promise.all([
    prisma.notification.count({ where: { accountId, status: { not: "READ" } } }),
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
    isReviewer
      ? prisma.contribution.count({
          where: {
            status: "SUBMITTED",
            OR: [{ activity: { managerAccountId: accountId } }, { need: { assigneeAccountId: accountId } }],
          },
        })
      : Promise.resolve(0),
    isReviewer
      ? prisma.activityAssignment.count({
          where: { status: "PROPOSED", activity: { managerAccountId: accountId } },
        })
      : Promise.resolve(0),
    isReviewer
      ? prisma.need.count({ where: { assigneeAccountId: accountId, status: "RECEIVED" } })
      : Promise.resolve(0),
    isAdmin ? prisma.invitation.count({ where: { status: "PENDING" } }) : Promise.resolve(0),
    isAdmin ? prisma.need.count({ where: { status: "RECEIVED" } }) : Promise.resolve(0),
  ]);

  return (
    <section>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>내 홈</h1>
      <p style={{ color: "var(--color-text-muted)", fontSize: 13, marginTop: 0 }}>
        참여 중인 활동과 기여 현황을 모아 봅니다.
      </p>

      {unreadNotificationCount > 0 && (
        <p className="notice-banner">
          새 알림이 {unreadNotificationCount}건 있습니다.{" "}
          <Link href="/my/notifications">확인하기 →</Link>
        </p>
      )}

      <p>
        <Link href="/my/contributions/new" className="btn-link">
          오늘 기록하기
        </Link>
      </p>

      {isReviewer && (pendingContributions > 0 || pendingAssignments > 0 || pendingOwnNeeds > 0) && (
        <>
          <h2 style={{ fontSize: 16, marginTop: 20 }}>담당자로서 처리할 일</h2>
          <ul className="card-list">
            {pendingContributions > 0 && (
              <li className="card">
                확인 대기 기여 {pendingContributions}건{" "}
                <Link href="/review" style={{ fontWeight: 600 }}>
                  담당자 확인함 →
                </Link>
              </li>
            )}
            {pendingAssignments > 0 && (
              <li className="card">
                참여 신청 대기 {pendingAssignments}건{" "}
                <Link href="/activities" style={{ fontWeight: 600 }}>
                  내 활동에서 확인 →
                </Link>
              </li>
            )}
            {pendingOwnNeeds > 0 && (
              <li className="card">
                확인 시작 대기 상담·수요 {pendingOwnNeeds}건{" "}
                <Link href="/needs" style={{ fontWeight: 600 }}>
                  우리 조합에서 확인 →
                </Link>
              </li>
            )}
          </ul>
        </>
      )}

      {isAdmin && (pendingInvitations > 0 || unreviewedNeeds > 0) && (
        <>
          <h2 style={{ fontSize: 16, marginTop: 20 }}>운영 현황</h2>
          <ul className="card-list">
            {pendingInvitations > 0 && (
              <li className="card">
                응답 대기 중인 초대 {pendingInvitations}건{" "}
                <Link href="/admin/invitations" style={{ fontWeight: 600 }}>
                  초대 관리 →
                </Link>
              </li>
            )}
            {unreviewedNeeds > 0 && (
              <li className="card">
                아직 확인을 시작하지 않은 상담·수요 {unreviewedNeeds}건 (조합 전체){" "}
                <Link href="/needs" style={{ fontWeight: 600 }}>
                  우리 조합에서 확인 →
                </Link>
              </li>
            )}
          </ul>
        </>
      )}

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
