import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveSession, revokeAllSessionsForAccount } from "@/lib/auth/session";
import { hasAnyRole } from "@/lib/auth/roles";

const ADMIN_ROLES = ["SECRETARIAT", "SYSTEM_ADMIN"] as const;

// TOTP 재설정 — 임원·재무·운영관리자 등 TOTP가 강제되는 역할(ELEVATED_ROLES,
// src/lib/auth/config.ts)인 계정이 기기와 복구 코드 10개를 모두 잃어버리면
// /login/totp에 코드 입력 칸과 복구 코드 입력 칸만 있어 앱 안에 복구 수단이
// 전혀 없었다 — 지금까지는 DB를 직접 고쳐야만 풀렸다. 이 계정의
// totpSecretCiphertext·totpEnabledAt을 지워 다음 로그인 때 새로 등록
// (/login/totp/setup)하게 한다.
//
// 자기 자신에게는 쓸 수 없다 — 계정 상태 자기 변경 금지와 같은 이유지만,
// 여기서는 위험이 다르다: 세션을 탈취한 사람이 스스로 자기(피해자) 계정의
// 2단계 인증을 꺼버리고 자기 기기로 다시 등록해 버리면 원래 소유자를 완전히
// 몰아낼 수 있다. 다른 관리자가 처리하게(두 사람 확인) 막는다.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const active = await getActiveSession();
  if (!active) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (!(await hasAnyRole(active.account.id, [...ADMIN_ROLES]))) {
    return NextResponse.redirect(new URL("/forbidden", request.url));
  }

  const { id } = await params;

  if (id === active.account.id) {
    return NextResponse.redirect(
      new URL("/admin/accounts?error=cannot_reset_own_totp", request.url),
    );
  }

  const account = await prisma.account.findUnique({ where: { id } });
  if (!account) {
    return NextResponse.redirect(new URL("/admin/accounts", request.url));
  }
  if (!account.totpEnabledAt) {
    return NextResponse.redirect(new URL("/admin/accounts?error=totp_not_enrolled", request.url));
  }

  const formData = await request.formData();
  const reasonRaw = formData.get("reason");
  const reason = typeof reasonRaw === "string" ? reasonRaw.trim() : "";
  if (!reason) {
    return NextResponse.redirect(new URL("/admin/accounts?error=reason_required", request.url));
  }

  await prisma.$transaction(async (tx) => {
    await tx.account.update({
      where: { id },
      data: { totpEnabledAt: null, totpSecretCiphertext: null },
    });
    // 예전 비밀키로 발급된 복구 코드는 새 비밀키와 아무 관계가 없다 — 다음
    // 등록 때 새로 10개를 발급하므로, 남아 있던 코드는 지운다(이미 쓴 코드도
    // 함께 — 흔적을 남길 이유가 없다).
    const deletedCodes = await tx.totpRecoveryCode.deleteMany({ where: { accountId: id } });
    await tx.auditLog.create({
      data: {
        entityType: "Account",
        entityId: id,
        action: "UPDATE",
        actorAccountId: active.account.id,
        beforeData: { totpEnabled: true },
        afterData: { totpEnabled: false, deletedRecoveryCodes: deletedCodes.count },
        reason: `TOTP 재설정: ${reason}`,
      },
    });
  });

  // 기기·복구 코드를 모두 잃어버린 상황이라 보통 유효한 세션이 없지만, 혹시
  // 남아 있는 세션이 있다면 이번 기회에 전부 끊어 재로그인(과 새 등록)을
  // 강제한다 — 자격 증명을 재설정한 뒤 기존 세션을 끊는 일반적인 원칙이다.
  await revokeAllSessionsForAccount(id);

  return NextResponse.redirect(new URL("/admin/accounts", request.url));
}
