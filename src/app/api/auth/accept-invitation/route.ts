import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashToken } from "@/lib/auth/crypto";
import { createSession } from "@/lib/auth/session";
import { ELEVATED_ROLES } from "@/lib/auth/config";

// FR-01: 초대는 최초 1회 가입에만 쓰고, 이후 로그인은 /api/auth/login·/api/auth/verify를 쓴다.
// R1은 SMS를 보류했으므로(ADR-0002) contact는 항상 이메일이라고 가정한다.
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(new URL("/login?error=invalid_token", request.url));
  }

  const invitation = await prisma.invitation.findUnique({
    where: { tokenHash: hashToken(token) },
  });

  if (!invitation || invitation.status !== "PENDING" || invitation.expiresAt < new Date()) {
    return NextResponse.redirect(new URL("/login?error=invalid_token", request.url));
  }

  const email = invitation.contact.toLowerCase();
  const existing = await prisma.account.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.redirect(new URL("/login?error=already_registered", request.url));
  }

  const account = await prisma.$transaction(async (tx) => {
    const created = await tx.account.create({
      data: {
        email,
        status: "ACTIVE",
        subjectId: invitation.prelinkedSubjectId ?? undefined,
      },
    });
    await tx.invitation.update({
      where: { id: invitation.id },
      data: { status: "ACCEPTED", acceptedAccountId: created.id },
    });
    if (invitation.suggestedRole) {
      await tx.permissionGrant.create({
        data: {
          accountId: created.id,
          role: invitation.suggestedRole,
          grantedByAccountId: invitation.invitedByAccountId,
        },
      });
    }
    return created;
  });

  const requiresTotp = invitation.suggestedRole
    ? ELEVATED_ROLES.includes(invitation.suggestedRole)
    : false;

  await createSession({ accountId: account.id, pendingSecondFactor: requiresTotp });

  return NextResponse.redirect(
    new URL(requiresTotp ? "/login/totp/setup" : "/", request.url),
  );
}
