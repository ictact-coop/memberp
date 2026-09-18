import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireActiveSession } from "@/lib/auth/session";
import { ACTIVITY_OPERATIONS_ROLES, hasAnyRole } from "@/lib/auth/roles";
import { ACTIVITY_STATUS_BADGE_TONE, ACTIVITY_STATUS_LABELS } from "@/lib/activity-labels";

export const dynamic = "force-dynamic";

// 활동 목록 — FR-04(활동 등록·조회). 열람 권한에 따른 필터링은 아직 없다:
// 이 스켈레톤은 Prisma↔Next.js 연결을 확인하기 위한 것으로, 인증·권한이 붙기 전까지는
// 임시로 archivedAt이 없는 모든 활동을 보여준다.
export default async function ActivitiesPage() {
  const active = await requireActiveSession();
  const [activities, canCreate] = await Promise.all([
    prisma.activity.findMany({
      where: { archivedAt: null },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    hasAnyRole(active.account.id, ACTIVITY_OPERATIONS_ROLES),
  ]);

  return (
    <section>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>참여할 일</h1>
      <p style={{ color: "var(--color-text-muted)", fontSize: 13, marginTop: 0 }}>
        지금 참여할 수 있는 활동을 한눈에 봅니다.
      </p>
      {canCreate && (
        <p>
          <Link href="/activities/new" className="btn-link">
            + 새 활동 등록
          </Link>
        </p>
      )}
      {activities.length === 0 ? (
        <p className="card" style={{ color: "var(--color-text-muted)" }}>
          등록된 활동이 없습니다.
        </p>
      ) : (
        <ul className="card-list">
          {activities.map((activity) => (
            <li key={activity.id} className="card">
              <Link href={`/activities/${activity.id}`} style={{ textDecoration: "none" }}>
                <strong>{activity.title}</strong>
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
                  <span>{activity.displayId}</span>
                  <span className={`badge ${ACTIVITY_STATUS_BADGE_TONE[activity.status]}`}>
                    {ACTIVITY_STATUS_LABELS[activity.status]}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
