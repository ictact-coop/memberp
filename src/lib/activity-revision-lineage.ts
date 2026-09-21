import type { ActivityStatus, PrismaClient } from "@prisma/client";

export interface LineageActivity {
  id: string;
  displayId: string;
  title: string;
  status: ActivityStatus;
  createdAt: Date;
  closedAt: Date | null;
  revisionOfId: string | null;
  supersededByActivityId: string | null;
}

const LINEAGE_SELECT = {
  id: true,
  displayId: true,
  title: true,
  status: true,
  createdAt: true,
  closedAt: true,
  revisionOfId: true,
  supersededByActivityId: true,
} as const;

// 정정 계보 — revisionOfId/supersededByActivityId로 이어진 연결 목록을 원본부터
// 최신까지 한 번에 걸어서 모은다. 활동 상세 화면의 배너는 한 단계(원본↔최신)만
// 오갈 수 있어, 두 번 이상 정정된 경우 중간 버전을 보려면 이 목록이 필요하다.
// 방문한 id를 추적해, 데이터 이상으로 순환이 생기더라도 무한 루프에 빠지지 않는다.
export async function getActivityRevisionLineage(
  prisma: Pick<PrismaClient, "activity">,
  activityId: string,
): Promise<LineageActivity[]> {
  const current = await prisma.activity.findUnique({ where: { id: activityId }, select: LINEAGE_SELECT });
  if (!current) return [];

  const visited = new Set<string>([current.id]);
  let root = current;
  while (root.revisionOfId && !visited.has(root.revisionOfId)) {
    const prev = await prisma.activity.findUnique({ where: { id: root.revisionOfId }, select: LINEAGE_SELECT });
    if (!prev) break;
    visited.add(prev.id);
    root = prev;
  }

  const chain = [root];
  const chainVisited = new Set<string>([root.id]);
  let node = root;
  while (node.supersededByActivityId && !chainVisited.has(node.supersededByActivityId)) {
    const next = await prisma.activity.findUnique({
      where: { id: node.supersededByActivityId },
      select: LINEAGE_SELECT,
    });
    if (!next) break;
    chain.push(next);
    chainVisited.add(next.id);
    node = next;
  }

  return chain;
}
