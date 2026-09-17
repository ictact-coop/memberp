import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireActiveSession } from "@/lib/auth/session";
import { ACTIVITY_OPERATIONS_ROLES, hasAnyRole } from "@/lib/auth/roles";
import { ACTIVITY_STATUS_LABELS } from "@/lib/activity-labels";

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
      <h1 style={{ fontSize: 20 }}>참여할 일</h1>
      {canCreate && (
        <p>
          <Link href="/activities/new">+ 새 활동 등록</Link>
        </p>
      )}
      {activities.length === 0 ? (
        <p style={{ color: "#555555" }}>등록된 활동이 없습니다.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {activities.map((activity) => (
            <li
              key={activity.id}
              style={{ borderBottom: "1px solid #e0e0e0", padding: "12px 0" }}
            >
              <Link href={`/activities/${activity.id}`}>
                <strong>{activity.title}</strong>
                <div style={{ fontSize: 12, color: "#888888" }}>
                  {activity.displayId} · {ACTIVITY_STATUS_LABELS[activity.status]}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
