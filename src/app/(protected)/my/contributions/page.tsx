import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireActiveSession } from "@/lib/auth/session";
import {
  CONTRIBUTION_STATUS_BADGE_TONE,
  CONTRIBUTION_STATUS_LABELS,
  CONTRIBUTION_TYPE_LABELS,
} from "@/lib/contribution-labels";

// 내 기여 — FR-07. 임시저장·제출·보완·확인 상태와 수정 이력을 보여준다.
export default async function MyContributionsPage() {
  const active = await requireActiveSession();

  if (!active.account.subjectId) {
    return (
      <section>
        <h1 style={{ fontSize: 20 }}>내 기여</h1>
        <p style={{ color: "var(--color-danger)" }}>
          계정에 연결된 사람 정보가 없습니다. 사무국에 문의하세요.
        </p>
      </section>
    );
  }

  const contributions = await prisma.contribution.findMany({
    where: { contributorSubjectId: active.account.subjectId },
    include: { activity: { select: { title: true } }, need: { select: { title: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <section>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>내 기여</h1>
      <p style={{ color: "var(--color-text-muted)", fontSize: 13, marginTop: 0 }}>
        임시저장·제출·확인 상태를 한눈에 봅니다.
      </p>
      <p>
        <Link href="/my/contributions/new" className="btn-link">
          + 새 기여 작성
        </Link>
      </p>

      {contributions.length === 0 ? (
        <p className="card" style={{ color: "var(--color-text-muted)" }}>
          아직 작성한 기여가 없습니다.
        </p>
      ) : (
        <ul className="card-list">
          {contributions.map((contribution) => (
            <li key={contribution.id} className="card">
              <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                {contribution.displayId}
              </div>
              <div style={{ fontWeight: 600, margin: "2px 0" }}>
                {contribution.activity?.title ?? contribution.need?.title ?? "(연결 안 됨)"}
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
                <span className={`badge ${CONTRIBUTION_STATUS_BADGE_TONE[contribution.status]}`}>
                  {CONTRIBUTION_STATUS_LABELS[contribution.status]}
                </span>
                <span>{CONTRIBUTION_TYPE_LABELS[contribution.contributionType]}</span>
                <span>{contribution.minutes != null ? `${contribution.minutes}분` : "시간 미상"}</span>
              </div>
              {contribution.status === "NEEDS_REVISION" && contribution.revisionReason && (
                <div style={{ fontSize: 12, color: "var(--color-danger)", marginTop: 6 }}>
                  보완 요청: {contribution.revisionReason}
                </div>
              )}
              {(contribution.status === "DRAFT" || contribution.status === "NEEDS_REVISION") && (
                <p style={{ marginBottom: 0, marginTop: 8 }}>
                  <Link href={`/my/contributions/new?id=${contribution.id}`} style={{ fontWeight: 600 }}>
                    이어 작성 →
                  </Link>
                </p>
              )}
              {contribution.status === "CONFIRMED" && !contribution.supersededByContributionId && (
                <p style={{ marginBottom: 0, marginTop: 8 }}>
                  <Link
                    href={`/my/contributions/new?reviseOf=${contribution.id}`}
                    style={{ fontWeight: 600 }}
                  >
                    정정 요청 →
                  </Link>
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
