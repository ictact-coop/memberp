import type { Prisma, PrismaClient } from "@prisma/client";

// 기구 병합("아직 없는 것"에서 처음 채운 틈)과 사람 주체 병합(동명이인·중복
// 정리)이 공유하는 로직 — Subject.id를 가리키는 모든 참조를 열거해 옮긴다.
// 새로 Subject를 참조하는 필드가 생기면 여기 한 곳만 고치면 된다.
export interface SubjectMergeCounts {
  raisedNeeds: number;
  beneficiaryNeeds: number;
  organizedActivities: number;
  activityAssignments: number;
  contributions: number;
  orgUnitPermissionGrants: number;
  linkedAccounts: number;
}

export async function countSubjectReferences(
  prisma: Pick<
    PrismaClient,
    "need" | "activity" | "activityAssignment" | "contribution" | "permissionGrant" | "account"
  >,
  subjectId: string,
): Promise<SubjectMergeCounts> {
  const [
    raisedNeeds,
    beneficiaryNeeds,
    organizedActivities,
    activityAssignments,
    contributions,
    orgUnitPermissionGrants,
    linkedAccounts,
  ] = await Promise.all([
    prisma.need.count({ where: { raisedBySubjectId: subjectId } }),
    prisma.need.count({ where: { beneficiarySubjectId: subjectId } }),
    prisma.activity.count({ where: { organizerSubjectId: subjectId } }),
    prisma.activityAssignment.count({ where: { subjectId } }),
    prisma.contribution.count({ where: { contributorSubjectId: subjectId } }),
    prisma.permissionGrant.count({ where: { scopeType: "ORG_UNIT", scopeId: subjectId } }),
    prisma.account.count({ where: { subjectId } }),
  ]);
  return {
    raisedNeeds,
    beneficiaryNeeds,
    organizedActivities,
    activityAssignments,
    contributions,
    orgUnitPermissionGrants,
    linkedAccounts,
  };
}

// source를 가리키던 모든 참조를 target으로 옮긴다. 로그인 계정 이전은 호출하는
// 쪽에서 sourceAccountId가 있을 때만 하도록 남겨둔다 — "둘 다 계정이 있으면
// 병합 금지" 같은 사전 검증은 병합 종류(기구/사람)마다 메시지가 다르므로 각
// 라우트에서 하고, 여기서는 실제 이전만 담당한다.
export async function reassignSubjectReferences(
  tx: Prisma.TransactionClient,
  sourceId: string,
  targetId: string,
): Promise<void> {
  await tx.need.updateMany({ where: { raisedBySubjectId: sourceId }, data: { raisedBySubjectId: targetId } });
  await tx.need.updateMany({
    where: { beneficiarySubjectId: sourceId },
    data: { beneficiarySubjectId: targetId },
  });
  await tx.activity.updateMany({
    where: { organizerSubjectId: sourceId },
    data: { organizerSubjectId: targetId },
  });
  await tx.activityAssignment.updateMany({ where: { subjectId: sourceId }, data: { subjectId: targetId } });
  await tx.contribution.updateMany({
    where: { contributorSubjectId: sourceId },
    data: { contributorSubjectId: targetId },
  });
  await tx.permissionGrant.updateMany({
    where: { scopeType: "ORG_UNIT", scopeId: sourceId },
    data: { scopeId: targetId },
  });
}
