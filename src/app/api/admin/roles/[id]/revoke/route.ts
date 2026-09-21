import { NextResponse } from "next/server";
import type { PermissionRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getActiveSession } from "@/lib/auth/session";
import { hasAnyRole } from "@/lib/auth/roles";

const ADMIN_ROLES: PermissionRole[] = ["SECRETARIAT", "SYSTEM_ADMIN"];

// 종료는 삭제가 아니라 endDate를 지금으로 채우는 것이다 — 누가 언제까지 그 역할을
// 가지고 있었는지 이력을 남긴다(v0.1 §2.1 "삭제 대신 보관").
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const active = await getActiveSession();
  if (!active) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (!(await hasAnyRole(active.account.id, ADMIN_ROLES))) {
    return NextResponse.redirect(new URL("/forbidden", request.url));
  }

  const { id } = await params;
  const grant = await prisma.permissionGrant.findUnique({ where: { id } });
  if (!grant) {
    return NextResponse.redirect(new URL("/admin/roles", request.url));
  }

  // 자기 자신의 마지막 관리자 권한을 스스로 없애 관리 화면에서 잠기는 것을 막는다.
  if (grant.accountId === active.account.id && ADMIN_ROLES.includes(grant.role)) {
    const now = new Date();
    const remainingAdminGrants = await prisma.permissionGrant.count({
      where: {
        accountId: active.account.id,
        role: { in: ADMIN_ROLES },
        id: { not: grant.id },
        startDate: { lte: now },
        OR: [{ endDate: null }, { endDate: { gte: now } }],
      },
    });
    if (remainingAdminGrants === 0) {
      return NextResponse.redirect(new URL("/admin/roles?error=self_lockout", request.url));
    }
  }

  await prisma.permissionGrant.update({
    where: { id: grant.id },
    data: { endDate: new Date() },
  });

  return NextResponse.redirect(new URL("/admin/roles", request.url));
}
