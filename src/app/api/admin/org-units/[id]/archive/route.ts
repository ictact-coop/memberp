import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveSession } from "@/lib/auth/session";
import { hasAnyRole } from "@/lib/auth/roles";

const ADMIN_ROLES = ["SECRETARIAT", "SYSTEM_ADMIN"] as const;

// 기구 보관 — 삭제가 아니라 archivedAt만 채운다(v0.1 §2.1 "삭제 대신 보관").
// 보관된 기구는 등록 화면·역할 관리 화면의 선택형 등 archivedAt: null을 거르는
// 모든 조회에서 자동으로 빠지지만, 이미 참조하고 있던 PermissionGrant.scopeId나
// Need.raisedBySubjectId 등은 그대로 유지된다 — 실제로 지우는 것이 아니기 때문이다.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const active = await getActiveSession();
  if (!active) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (!(await hasAnyRole(active.account.id, [...ADMIN_ROLES]))) {
    return NextResponse.redirect(new URL("/forbidden", request.url));
  }

  const { id } = await params;
  const orgUnit = await prisma.subject.findUnique({ where: { id } });
  if (!orgUnit || orgUnit.type !== "ORG_UNIT") {
    return NextResponse.redirect(new URL("/admin/org-units", request.url));
  }
  if (orgUnit.archivedAt) {
    return NextResponse.redirect(new URL("/admin/org-units", request.url));
  }

  const archivedAt = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.subject.update({
      where: { id },
      data: { archivedAt, updatedBy: active.account.id },
    });
    await tx.auditLog.create({
      data: {
        entityType: "Subject",
        entityId: id,
        action: "ARCHIVE",
        actorAccountId: active.account.id,
        beforeData: { archivedAt: null },
        afterData: { archivedAt },
      },
    });
  });

  return NextResponse.redirect(new URL("/admin/org-units", request.url));
}
