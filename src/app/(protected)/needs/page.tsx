import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireActiveSession } from "@/lib/auth/session";
import { ACTIVITY_OPERATIONS_ROLES, hasAnyRole } from "@/lib/auth/roles";
import { NEED_STATUS_LABELS } from "@/lib/need-labels";

export const dynamic = "force-dynamic";

// 상담·수요 = "우리 조합" — FR-08. 활동 목록(/activities)과 같은 원칙: 목록은
// 로그인한 누구나 볼 수 있고, 접수(등록)는 활동 운영 역할을 가진 계정만 할 수 있다.
export default async function NeedsPage() {
  const active = await requireActiveSession();
  const [needs, canCreate] = await Promise.all([
    prisma.need.findMany({
      where: { archivedAt: null },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    hasAnyRole(active.account.id, ACTIVITY_OPERATIONS_ROLES),
  ]);

  return (
    <section>
      <h1 style={{ fontSize: 20 }}>우리 조합</h1>
      {canCreate && (
        <p>
          <Link href="/needs/new">+ 새 상담·수요 접수</Link>
        </p>
      )}
      {needs.length === 0 ? (
        <p style={{ color: "#555555" }}>접수된 상담·수요가 없습니다.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {needs.map((need) => (
            <li key={need.id} style={{ borderBottom: "1px solid #e0e0e0", padding: "12px 0" }}>
              <Link href={`/needs/${need.id}`}>
                <strong>{need.title}</strong>
                <div style={{ fontSize: 12, color: "#888888" }}>
                  {need.displayId} · {NEED_STATUS_LABELS[need.status]}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
