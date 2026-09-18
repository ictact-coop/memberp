import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveSession } from "@/lib/auth/session";
import { hasAnyRole } from "@/lib/auth/roles";

const ADMIN_ROLES = ["SECRETARIAT", "SYSTEM_ADMIN"] as const;

// 보관 복원 — archivedAt을 다시 null로 되돌린다. 보관이 되돌릴 수 있는 결정이라는
// 것을 실제로 보장하는 절반이다(나머지 절반은 애초에 삭제하지 않는 것).
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
  if (!orgUnit.archivedAt) {
    return NextResponse.redirect(new URL("/admin/org-units", request.url));
  }

  const previousArchivedAt = orgUnit.archivedAt;
  await prisma.$transaction(async (tx) => {
    await tx.subject.update({
      where: { id },
      data: { archivedAt: null, updatedBy: active.account.id },
    });
    await tx.auditLog.create({
      data: {
        entityType: "Subject",
        entityId: id,
        action: "UPDATE",
        actorAccountId: active.account.id,
        beforeData: { archivedAt: previousArchivedAt },
        afterData: { archivedAt: null },
      },
    });
  });

  return NextResponse.redirect(new URL("/admin/org-units", request.url));
}
