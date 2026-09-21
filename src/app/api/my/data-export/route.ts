import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveSession } from "@/lib/auth/session";
import { buildExportResponse } from "@/lib/data-export";

// 본인 데이터 내보내기 — 병행운영전략 v0.2가 요구하는 "내보내기·백업" 중 개인
// 자기결정권 쪽. 역할과 무관하게 로그인만 되어 있으면 누구나 자신에 관한 데이터를
// 받아볼 수 있다. 2단계 인증 비밀·세션 토큰은 포함하지 않는다.
export async function POST(request: Request) {
  const active = await getActiveSession();
  if (!active) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const accountId = active.account.id;
  const subjectId = active.account.subjectId;

  const [
    account,
    subject,
    contributions,
    activityAssignments,
    managedActivities,
    assignedNeeds,
    raisedNeeds,
    beneficiaryNeeds,
    notifications,
    permissionGrants,
    uploadedAttachments,
    auditLogsAsActor,
  ] = await prisma.$transaction([
    prisma.account.findUnique({
      where: { id: accountId },
      select: {
        id: true,
        email: true,
        phone: true,
        status: true,
        subjectId: true,
        totpEnabledAt: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.subject.findFirst({ where: { id: subjectId ?? "__none__" } }),
    prisma.contribution.findMany({
      where: { contributorSubjectId: subjectId ?? "__none__" },
      orderBy: { createdAt: "asc" },
    }),
    prisma.activityAssignment.findMany({
      where: { subjectId: subjectId ?? "__none__" },
      orderBy: { createdAt: "asc" },
    }),
    prisma.activity.findMany({ where: { managerAccountId: accountId }, orderBy: { createdAt: "asc" } }),
    prisma.need.findMany({ where: { assigneeAccountId: accountId }, orderBy: { createdAt: "asc" } }),
    prisma.need.findMany({
      where: { raisedBySubjectId: subjectId ?? "__none__" },
      orderBy: { createdAt: "asc" },
    }),
    prisma.need.findMany({
      where: { beneficiarySubjectId: subjectId ?? "__none__" },
      orderBy: { createdAt: "asc" },
    }),
    prisma.notification.findMany({ where: { accountId }, orderBy: { createdAt: "asc" } }),
    prisma.permissionGrant.findMany({ where: { accountId }, orderBy: { createdAt: "asc" } }),
    prisma.attachment.findMany({ where: { uploadedByAccountId: accountId }, orderBy: { uploadedAt: "asc" } }),
    prisma.auditLog.findMany({ where: { actorAccountId: accountId }, orderBy: { occurredAt: "asc" } }),
  ]);

  await prisma.auditLog.create({
    data: {
      entityType: "Account",
      entityId: accountId,
      action: "EXPORT",
      actorAccountId: accountId,
      reason: "본인 데이터 내보내기",
    },
  });

  return buildExportResponse(
    {
      exportedAt: new Date().toISOString(),
      data: {
        account,
        subject,
        contributions,
        activityAssignments,
        managedActivities,
        assignedNeeds,
        raisedNeeds,
        beneficiaryNeeds,
        notifications,
        permissionGrants,
        uploadedAttachments,
        auditLogsAsActor,
      },
    },
    "memberp-my-data",
  );
}
