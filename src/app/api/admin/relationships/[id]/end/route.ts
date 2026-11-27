import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveSession } from "@/lib/auth/session";
import { hasAnyRole } from "@/lib/auth/roles";

const ADMIN_ROLES = ["SECRETARIAT", "SYSTEM_ADMIN"] as const;

// 관계 종료 — 행을 지우지 않고 endDate만 채운다. 그 관계가 실제로 있었다는
// 사실(과거 소속 등)은 다른 이력성 데이터와 같은 원칙으로 남긴다.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const active = await getActiveSession();
  if (!active) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (!(await hasAnyRole(active.account.id, [...ADMIN_ROLES]))) {
    return NextResponse.redirect(new URL("/forbidden", request.url));
  }

  const { id } = await params;
  const relationship = await prisma.relationship.findUnique({ where: { id } });
  if (!relationship) {
    return NextResponse.redirect(new URL("/admin/subjects", request.url));
  }

  if (!relationship.endDate) {
    const endDate = new Date();
    await prisma.$transaction([
      prisma.relationship.update({
        where: { id },
        data: { endDate, updatedBy: active.account.id },
      }),
      prisma.auditLog.create({
        data: {
          entityType: "Relationship",
          entityId: id,
          action: "UPDATE",
          actorAccountId: active.account.id,
          reason: "관계 종료",
          beforeData: { endDate: relationship.endDate },
          afterData: { endDate },
        },
      }),
    ]);
  }

  return NextResponse.redirect(new URL(`/admin/subjects/${relationship.fromSubjectId}`, request.url));
}
