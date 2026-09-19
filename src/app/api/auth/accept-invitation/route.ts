import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
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

  let account;
  try {
    account = await prisma.$transaction(async (tx) => {
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
  } catch (err) {
    // 미리 연결된 사람이 그사이 다른 경로로 이미 계정을 갖게 됐다면
    // (Account.subjectId 유일 제약) 여기서 막힌다 — 초대 발급 시점에도 같은 조건을
    // 확인하지만(관리자 화면), 그 사이의 경쟁까지 완전히 막을 수는 없다.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.redirect(new URL("/login?error=prelink_conflict", request.url));
    }
    throw err;
  }

  const requiresTotp = invitation.suggestedRole
    ? ELEVATED_ROLES.includes(invitation.suggestedRole)
    : false;

  await createSession({ accountId: account.id, pendingSecondFactor: requiresTotp });

  return NextResponse.redirect(
    new URL(requiresTotp ? "/login/totp/setup" : "/", request.url),
  );
}
