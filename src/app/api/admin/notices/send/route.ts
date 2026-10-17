import { NextResponse } from "next/server";
import type { PermissionRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getActiveSession } from "@/lib/auth/session";
import { hasAnyRole } from "@/lib/auth/roles";

const ADMIN_ROLES = ["SECRETARIAT", "SYSTEM_ADMIN"] as const;
const VALID_ROLES = [
  "MEMBER",
  "ACTIVITY_MANAGER",
  "DOMAIN_OPERATOR",
  "SECRETARIAT",
  "FINANCE",
  "BOARD",
  "SYSTEM_ADMIN",
  "EXTERNAL_PARTICIPANT",
] as const satisfies readonly PermissionRole[];

// 공지사항 발송 — NotificationType.GENERIC은 R1 스키마 설계 때부터 있었지만
// "나중에 정형화되지 않은 공지가 필요해지면 쓸 자리"로 아무 데서도 안 쓰고
// 있었다("알림 화면" 절 참고). 전체 활성 계정 또는 특정 역할을 가진 계정에게
// 한 번에 알림을 만들어 채운다.
export async function POST(request: Request) {
  const active = await getActiveSession();
  if (!active) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (!(await hasAnyRole(active.account.id, [...ADMIN_ROLES]))) {
    return NextResponse.redirect(new URL("/forbidden", request.url));
  }

  const formData = await request.formData();
  const titleRaw = formData.get("title");
  const bodyRaw = formData.get("body");
  const scopeRaw = formData.get("scope");
  const roleValues = formData.getAll("roles");

  if (typeof titleRaw !== "string" || !titleRaw.trim()) {
    return NextResponse.redirect(new URL("/admin/notices?error=invalid", request.url));
  }
  const title = titleRaw.trim();
  const body = typeof bodyRaw === "string" && bodyRaw.trim() ? bodyRaw.trim() : null;

  if (scopeRaw !== "ALL" && scopeRaw !== "ROLES") {
    return NextResponse.redirect(new URL("/admin/notices?error=invalid", request.url));
  }

  const roles = roleValues.filter(
    (value): value is PermissionRole =>
      typeof value === "string" && (VALID_ROLES as readonly string[]).includes(value),
  );
  if (scopeRaw === "ROLES" && roles.length === 0) {
    return NextResponse.redirect(new URL("/admin/notices?error=invalid_roles", request.url));
  }

  const now = new Date();
  const recipients = await prisma.account.findMany({
    where: {
      status: "ACTIVE",
      ...(scopeRaw === "ROLES"
        ? {
            permissionGrants: {
              some: {
                role: { in: roles },
                startDate: { lte: now },
                OR: [{ endDate: null }, { endDate: { gte: now } }],
              },
            },
          }
        : {}),
    },
    select: { id: true },
  });

  if (recipients.length === 0) {
    return NextResponse.redirect(new URL("/admin/notices?error=no_recipients", request.url));
  }

  await prisma.$transaction(async (tx) => {
    await tx.notification.createMany({
      data: recipients.map((r) => ({
        accountId: r.id,
        type: "GENERIC",
        title,
        body,
        status: "SENT",
        sentAt: now,
      })),
    });
    await tx.auditLog.create({
      data: {
        entityType: "Notice",
        entityId: "ALL",
        action: "CREATE",
        actorAccountId: active.account.id,
        afterData: {
          title,
          body,
          scope: scopeRaw,
          roles: scopeRaw === "ROLES" ? roles : null,
          recipientCount: recipients.length,
        },
        reason: `공지사항 발송: ${title}`,
      },
    });
  });

  return NextResponse.redirect(new URL("/admin/notices", request.url));
}
