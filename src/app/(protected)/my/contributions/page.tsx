import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireActiveSession } from "@/lib/auth/session";
import {
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
        <p style={{ color: "#c0392b" }}>계정에 연결된 사람 정보가 없습니다. 사무국에 문의하세요.</p>
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
      <h1 style={{ fontSize: 20 }}>내 기여</h1>
      <p>
        <Link href="/my/contributions/new">+ 새 기여 작성</Link>
      </p>

      {contributions.length === 0 ? (
        <p style={{ color: "#555555" }}>아직 작성한 기여가 없습니다.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {contributions.map((contribution) => (
            <li key={contribution.id} style={{ borderBottom: "1px solid #e0e0e0", padding: "12px 0" }}>
              <div style={{ fontSize: 12, color: "#888888" }}>{contribution.displayId}</div>
              <div>{contribution.activity?.title ?? contribution.need?.title ?? "(연결 안 됨)"}</div>
              <div style={{ fontSize: 12, color: "#555555" }}>
                {CONTRIBUTION_STATUS_LABELS[contribution.status]} ·{" "}
                {CONTRIBUTION_TYPE_LABELS[contribution.contributionType]} ·{" "}
                {contribution.minutes != null ? `${contribution.minutes}분` : "시간 미상"}
              </div>
              {contribution.status === "NEEDS_REVISION" && contribution.revisionReason && (
                <div style={{ fontSize: 12, color: "#c0392b" }}>
                  보완 요청: {contribution.revisionReason}
                </div>
              )}
              {(contribution.status === "DRAFT" || contribution.status === "NEEDS_REVISION") && (
                <Link href={`/my/contributions/new?id=${contribution.id}`}>이어 작성 →</Link>
              )}
              {contribution.status === "CONFIRMED" && !contribution.supersededByContributionId && (
                <>
                  {" "}
                  <Link href={`/my/contributions/new?reviseOf=${contribution.id}`}>정정 요청 →</Link>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
