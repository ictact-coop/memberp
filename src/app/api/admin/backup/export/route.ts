import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveSession } from "@/lib/auth/session";
import { hasAnyRole } from "@/lib/auth/roles";
import { buildExportResponse } from "@/lib/data-export";

const ADMIN_ROLES = ["SECRETARIAT", "SYSTEM_ADMIN"] as const;

// 관리자 전체 데이터 내보내기 — 병행운영전략 v0.2가 요구하는 "조합이 데이터를
// 통제하고 다른 운영자로 이전할 수 있어야 한다"를 만족하기 위한 백업.
// 인증 비밀(Session/LoginToken/RecoveryCode/TOTP 암호문)은 포함하지 않는다 —
// 이 내보내기는 업무 데이터 이전·복구용이지, 로그인 상태를 복제하는 용도가 아니다.
export async function POST(request: Request) {
  const active = await getActiveSession();
  if (!active) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (!(await hasAnyRole(active.account.id, [...ADMIN_ROLES]))) {
    return NextResponse.redirect(new URL("/forbidden", request.url));
  }

  const [
    subjects,
    accounts,
    classifications,
    activityClassifications,
    needs,
    needActivityLinks,
    activities,
    activityAssignments,
    contributions,
    attachments,
    notifications,
    permissionGrants,
    invitations,
    auditLogs,
  ] = await prisma.$transaction([
    prisma.subject.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.account.findMany({
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
      orderBy: { createdAt: "asc" },
    }),
    prisma.classification.findMany({ orderBy: { domain: "asc" } }),
    prisma.activityClassification.findMany(),
    prisma.need.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.needActivityLink.findMany(),
    prisma.activity.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.activityAssignment.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.contribution.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.attachment.findMany({ orderBy: { uploadedAt: "asc" } }),
    prisma.notification.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.permissionGrant.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.invitation.findMany({
      select: {
        id: true,
        contact: true,
        expiresAt: true,
        status: true,
        invitedByAccountId: true,
        prelinkedSubjectId: true,
        suggestedRole: true,
        acceptedAccountId: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.auditLog.findMany({ orderBy: { occurredAt: "asc" } }),
  ]);

  const counts = {
    subjects: subjects.length,
    accounts: accounts.length,
    classifications: classifications.length,
    activityClassifications: activityClassifications.length,
    needs: needs.length,
    needActivityLinks: needActivityLinks.length,
    activities: activities.length,
    activityAssignments: activityAssignments.length,
    contributions: contributions.length,
    attachments: attachments.length,
    notifications: notifications.length,
    permissionGrants: permissionGrants.length,
    invitations: invitations.length,
    auditLogs: auditLogs.length,
  };

  await prisma.auditLog.create({
    data: {
      entityType: "Backup",
      entityId: "ALL",
      action: "EXPORT",
      actorAccountId: active.account.id,
      afterData: counts,
      reason: "관리자 전체 데이터 내보내기",
    },
  });

  return buildExportResponse(
    {
      exportedAt: new Date().toISOString(),
      exportedByAccountId: active.account.id,
      counts,
      data: {
        subjects,
        accounts,
        classifications,
        activityClassifications,
        needs,
        needActivityLinks,
        activities,
        activityAssignments,
        contributions,
        attachments,
        notifications,
        permissionGrants,
        invitations,
        auditLogs,
      },
    },
    "memberp-backup",
  );
}
