import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashToken } from "@/lib/auth/crypto";
import { createSession } from "@/lib/auth/session";
import { ELEVATED_ROLES } from "@/lib/auth/config";
import { nextDisplayId } from "@/lib/display-id";

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
    // 기여를 남기려면 계정에 연결된 주체(사람)가 있어야 한다. 사무국이 미리 연결해둔
    // 사람이 없으면 최소 정보로 새 주체를 만들고 NEEDS_CONFIRMATION으로 표시한다 —
    // 동명이인 등 중복 여부는 사무국이 나중에 확인한다(v0.2 §4.3의 단순화 버전).
    let subjectId = invitation.prelinkedSubjectId;
    if (!subjectId) {
      const subject = await tx.subject.create({
        data: {
          displayId: await nextDisplayId(tx, "SUB"),
          type: "PERSON",
          name: email.split("@")[0] ?? email,
          status: "NEEDS_CONFIRMATION",
        },
      });
      subjectId = subject.id;
    }

    const created = await tx.account.create({
      data: {
        email,
        status: "ACTIVE",
        subjectId,
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
