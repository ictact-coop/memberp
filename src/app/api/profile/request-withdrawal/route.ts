import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveSession } from "@/lib/auth/session";

const ADMIN_ROLES = ["SECRETARIAT", "SYSTEM_ADMIN"] as const;

// 본인 탈퇴 신청 — 개인정보 자기결정권 쪽 요구를 한 단계 더 채운다(본인 데이터
// 내보내기와 짝을 이룬다). 지금까지 계정 탈퇴는 관리자만 처리할 수 있었다
// (FR-01, /admin/accounts). 여기서는 상태를 바로 바꾸지 않는다 — "신청"만
// 남기고, 실제 WITHDRAWN 전이는 관리자가 확정한다(조합 탈퇴는 정산 등 확인할
// 게 있을 수 있어 즉시 처리가 아니라 사람이 한 번 보는 과정을 거치게 했다).
export async function POST(request: Request) {
  const active = await getActiveSession();
  if (!active) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (active.account.withdrawalRequestedAt) {
    return NextResponse.redirect(new URL("/my/profile?error=already_requested", request.url));
  }

  const formData = await request.formData();
  const reasonRaw = formData.get("reason");
  const reason = typeof reasonRaw === "string" && reasonRaw.trim() ? reasonRaw.trim() : null;

  await prisma.$transaction(async (tx) => {
    await tx.account.update({
      where: { id: active.account.id },
      data: { withdrawalRequestedAt: new Date(), withdrawalRequestReason: reason },
    });
    await tx.auditLog.create({
      data: {
        entityType: "Account",
        entityId: active.account.id,
        action: "UPDATE",
        actorAccountId: active.account.id,
        afterData: { withdrawalRequested: true },
        reason: reason ? `탈퇴 신청: ${reason}` : "탈퇴 신청",
      },
    });

    // 신청만으로는 아무도 못 보게 묻혀 있을 수 있으니, 처리할 역할(사무국·
    // 시스템 관리자)에게 바로 알린다 — 공지사항 발송과 같은 GENERIC 알림
    // 통로를 재사용한다.
    const now = new Date();
    const admins = await tx.account.findMany({
      where: {
        status: "ACTIVE",
        permissionGrants: {
          some: {
            role: { in: [...ADMIN_ROLES] },
            startDate: { lte: now },
            OR: [{ endDate: null }, { endDate: { gte: now } }],
          },
        },
      },
      select: { id: true },
    });
    if (admins.length > 0) {
      await tx.notification.createMany({
        data: admins.map((admin) => ({
          accountId: admin.id,
          type: "GENERIC",
          title: `탈퇴 신청: ${active.account.email ?? active.account.phone}`,
          body: reason ?? "(사유를 남기지 않음)",
          status: "SENT",
          sentAt: now,
        })),
      });
    }
  });

  return NextResponse.redirect(new URL("/my/profile", request.url));
}
