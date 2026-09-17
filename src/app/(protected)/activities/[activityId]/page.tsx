import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// 활동 상세 — FR-04, FR-05(참여 신청·배치)
export default async function ActivityDetailPage({
  params,
}: {
  params: Promise<{ activityId: string }>;
}) {
  const { activityId } = await params;
  const activity = await prisma.activity.findUnique({
    where: { id: activityId },
    include: { assignments: true },
  });

  if (!activity) {
    notFound();
  }

  return (
    <section>
      <p style={{ fontSize: 12, color: "#888888" }}>{activity.displayId}</p>
      <h1 style={{ fontSize: 20 }}>{activity.title}</h1>
      <p style={{ color: "#555555" }}>{activity.purpose}</p>
      <dl>
        <dt>상태</dt>
        <dd>{activity.status}</dd>
        <dt>참여 배정</dt>
        <dd>{activity.assignments.length}건</dd>
      </dl>
      <p style={{ fontSize: 12, color: "#aaaaaa" }}>
        참여 신청(FR-05)·기여 작성(FR-06) 연동은 아직 구현되지 않았습니다.
      </p>
    </section>
  );
}
