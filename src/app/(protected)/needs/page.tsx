import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireActiveSession } from "@/lib/auth/session";
import { ACTIVITY_OPERATIONS_ROLES, hasAnyRole } from "@/lib/auth/roles";
import { NEED_STATUS_BADGE_TONE, NEED_STATUS_LABELS } from "@/lib/need-labels";

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
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>우리 조합</h1>
      <p style={{ color: "var(--color-text-muted)", fontSize: 13, marginTop: 0 }}>
        접수된 상담·수요 현황을 한눈에 봅니다.
      </p>
      {canCreate && (
        <p>
          <Link href="/needs/new" className="btn-link">
            + 새 상담·수요 접수
          </Link>
        </p>
      )}
      {needs.length === 0 ? (
        <p className="card" style={{ color: "var(--color-text-muted)" }}>
          접수된 상담·수요가 없습니다.
        </p>
      ) : (
        <ul className="card-list">
          {needs.map((need) => (
            <li key={need.id} className="card">
              <Link href={`/needs/${need.id}`} style={{ textDecoration: "none" }}>
                <strong>{need.title}</strong>
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
                  <span>{need.displayId}</span>
                  <span className={`badge ${NEED_STATUS_BADGE_TONE[need.status]}`}>
                    {NEED_STATUS_LABELS[need.status]}
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
