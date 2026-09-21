import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireActiveSession } from "@/lib/auth/session";
import { getActivityRevisionLineage } from "@/lib/activity-revision-lineage";
import { ACTIVITY_STATUS_BADGE_TONE, ACTIVITY_STATUS_LABELS } from "@/lib/activity-labels";

export const dynamic = "force-dynamic";

// 정정 계보 전체 보기 — 활동 상세의 배너는 원본↔최신 한 단계만 오갈 수 있어,
// 두 번 이상 정정된 경우 중간 버전을 보려면 이 화면이 필요하다(§"아직 없는 것"
// 에 있던 "정정 계보 조회 화면"). 활동 상세와 같은 접근 기준 — 로그인만 되어
// 있으면 누구나 볼 수 있다(수정·정정 자체는 여전히 책임자만 가능).
export default async function ActivityLineagePage({
  params,
}: {
  params: Promise<{ activityId: string }>;
}) {
  await requireActiveSession();
  const { activityId } = await params;

  const chain = await getActivityRevisionLineage(prisma, activityId);

  if (chain.length === 0) {
    notFound();
  }

  return (
    <section>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>정정 계보</h1>
      <p style={{ color: "var(--color-text-muted)", fontSize: 13, marginTop: 0 }}>
        원본부터 최신 버전까지 이 활동이 정정되어 온 순서입니다. 총 {chain.length}개 버전.
      </p>

      <ol className="card-list" style={{ listStyle: "none", padding: 0 }}>
        {chain.map((version, index) => {
          const isCurrent = version.id === activityId;
          const isLatest = index === chain.length - 1;
          return (
            <li key={version.id} className="card" style={isCurrent ? { borderColor: "var(--color-primary)" } : undefined}>
              <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                {index === 0 ? "원본" : `정정 ${index}차`}
                {isLatest && index > 0 ? " · 최신" : ""}
                {isCurrent ? " · 지금 보는 버전" : ""}
              </div>
              <div style={{ fontWeight: 600, margin: "2px 0" }}>
                {isCurrent ? (
                  <span>
                    {version.displayId} · {version.title}
                  </span>
                ) : (
                  <Link href={`/activities/${version.id}`}>
                    {version.displayId} · {version.title}
                  </Link>
                )}
              </div>
              <span className={`badge ${ACTIVITY_STATUS_BADGE_TONE[version.status]}`}>
                {ACTIVITY_STATUS_LABELS[version.status]}
              </span>
              {version.closedAt && (
                <span style={{ fontSize: 12, color: "var(--color-text-muted)", marginLeft: 8 }}>
                  종료일: {version.closedAt.toISOString().slice(0, 10)}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
