import type { PrismaClient } from "@prisma/client";

// 상위 활동(parentActivityId) 순환 방지 — activityId 자신을 포함해 모든 하위
// 활동(자식의 자식까지)의 id를 모은다. 트리가 몇 단계든 상관없이 안전하도록
// 자식이 더 안 나올 때까지 한 단계씩 넓혀간다. 이 결과에 포함된 활동을 상위
// 활동으로 지정하면 A→B→A 같은 순환이 생기므로 막아야 한다.
export async function getSelfAndDescendantActivityIds(
  prisma: Pick<PrismaClient, "activity">,
  rootId: string,
): Promise<Set<string>> {
  const collected = new Set<string>([rootId]);
  let frontier = [rootId];

  while (frontier.length > 0) {
    const children = await prisma.activity.findMany({
      where: { parentActivityId: { in: frontier } },
      select: { id: true },
    });
    frontier = children.map((child) => child.id).filter((id) => !collected.has(id));
    frontier.forEach((id) => collected.add(id));
  }

  return collected;
}
