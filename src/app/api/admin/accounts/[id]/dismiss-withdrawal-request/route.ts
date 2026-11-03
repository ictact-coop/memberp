import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveSession } from "@/lib/auth/session";
import { hasAnyRole } from "@/lib/auth/roles";

const ADMIN_ROLES = ["SECRETARIAT", "SYSTEM_ADMIN"] as const;

// 탈퇴 신청 처리 안 함(관리자) — 신청을 실제 탈퇴로 이어가지 않고 그냥 지운다
// (예: 확인해 보니 오해였거나, 본인과 먼저 이야기해 보기로 한 경우). 실제로
// 탈퇴시키려면 이 라우트가 아니라 기존 "탈퇴 처리" 버튼
// (/api/admin/accounts/[id]/status, action=withdraw)을 쓴다 — 그쪽이 성공하면
// 신청 기록은 자동으로 함께 지워진다.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const active = await getActiveSession();
  if (!active) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (!(await hasAnyRole(active.account.id, [...ADMIN_ROLES]))) {
    return NextResponse.redirect(new URL("/forbidden", request.url));
  }

  const { id } = await params;
  const account = await prisma.account.findUnique({ where: { id } });
  if (!account) {
    return NextResponse.redirect(new URL("/admin/accounts", request.url));
  }
  if (!account.withdrawalRequestedAt) {
    return NextResponse.redirect(new URL("/admin/accounts", request.url));
  }

  await prisma.$transaction(async (tx) => {
    await tx.account.update({
      where: { id },
      data: { withdrawalRequestedAt: null, withdrawalRequestReason: null },
    });
    await tx.auditLog.create({
      data: {
        entityType: "Account",
        entityId: id,
        action: "UPDATE",
        actorAccountId: active.account.id,
        afterData: { withdrawalRequested: false },
        reason: "탈퇴 신청 처리 안 함(관리자)",
      },
    });
  });

  return NextResponse.redirect(new URL("/admin/accounts", request.url));
}
