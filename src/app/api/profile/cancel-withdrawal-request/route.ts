import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveSession } from "@/lib/auth/session";

// 탈퇴 신청 취소(본인) — 관리자가 아직 처리하기 전까지는 마음을 바꿀 수 있다.
export async function POST(request: Request) {
  const active = await getActiveSession();
  if (!active) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (!active.account.withdrawalRequestedAt) {
    return NextResponse.redirect(new URL("/my/profile", request.url));
  }

  await prisma.$transaction(async (tx) => {
    await tx.account.update({
      where: { id: active.account.id },
      data: { withdrawalRequestedAt: null, withdrawalRequestReason: null },
    });
    await tx.auditLog.create({
      data: {
        entityType: "Account",
        entityId: active.account.id,
        action: "UPDATE",
        actorAccountId: active.account.id,
        afterData: { withdrawalRequested: false },
        reason: "탈퇴 신청 취소(본인)",
      },
    });
  });

  return NextResponse.redirect(new URL("/my/profile", request.url));
}
