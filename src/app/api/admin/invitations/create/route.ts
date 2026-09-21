import { NextResponse } from "next/server";
import { PermissionRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getActiveSession } from "@/lib/auth/session";
import { hasAnyRole } from "@/lib/auth/roles";
import { generateToken, hashToken } from "@/lib/auth/crypto";
import { getBaseUrl, INVITATION_TTL_DAYS } from "@/lib/auth/config";
import { sendInvitationEmail } from "@/lib/email/resend";

const ADMIN_ROLES: PermissionRole[] = ["SECRETARIAT", "SYSTEM_ADMIN"];

// FR-01 초대 발급. R1은 SMS를 보류했으므로(ADR-0002) contact는 이메일만 받는다.
// 사무국이 미리 등록해 둔 사람(Subject, 계정 없음)에 연결할 수 있다 — 고르지
// 않으면 지금까지처럼 accept-invitation route가 최소 정보의 새 주체를 만든다.
export async function POST(request: Request) {
  const active = await getActiveSession();
  if (!active) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (!(await hasAnyRole(active.account.id, ADMIN_ROLES))) {
    return NextResponse.redirect(new URL("/forbidden", request.url));
  }

  const formData = await request.formData();
  const contactRaw = formData.get("contact");
  const suggestedRoleRaw = formData.get("suggestedRole");
  const prelinkedSubjectIdRaw = formData.get("prelinkedSubjectId");

  if (typeof contactRaw !== "string" || !contactRaw.includes("@")) {
    return NextResponse.redirect(new URL("/admin/invitations?error=invalid_email", request.url));
  }
  const contact = contactRaw.trim().toLowerCase();

  const suggestedRole =
    typeof suggestedRoleRaw === "string" &&
    (Object.values(PermissionRole) as string[]).includes(suggestedRoleRaw)
      ? (suggestedRoleRaw as PermissionRole)
      : null;

  const existingAccount = await prisma.account.findUnique({ where: { email: contact } });
  if (existingAccount) {
    return NextResponse.redirect(
      new URL("/admin/invitations?error=already_registered", request.url),
    );
  }

  const existingPending = await prisma.invitation.findFirst({
    where: { contact, status: "PENDING" },
  });
  if (existingPending) {
    return NextResponse.redirect(
      new URL("/admin/invitations?error=already_invited", request.url),
    );
  }

  // 미리 연결할 사람은 계정이 아직 없는 사람 주체여야 하고, 다른 대기 중인
  // 초대가 이미 그 사람을 노리고 있으면 안 된다 — 두 초대가 같은 사람을
  // 동시에 채가려는 경쟁을 막는다(수락 시점의 Account.subjectId 유일 제약
  // 위반으로 이어지기 전에 여기서 미리 거른다).
  const prelinkedSubjectId =
    typeof prelinkedSubjectIdRaw === "string" && prelinkedSubjectIdRaw ? prelinkedSubjectIdRaw : null;
  if (prelinkedSubjectId) {
    const subject = await prisma.subject.findUnique({
      where: { id: prelinkedSubjectId },
      include: { account: true },
    });
    if (!subject || subject.type !== "PERSON" || subject.archivedAt || subject.account) {
      return NextResponse.redirect(new URL("/admin/invitations?error=invalid_subject", request.url));
    }
    const conflictingInvitation = await prisma.invitation.findFirst({
      where: { prelinkedSubjectId, status: "PENDING" },
    });
    if (conflictingInvitation) {
      return NextResponse.redirect(
        new URL("/admin/invitations?error=subject_already_invited", request.url),
      );
    }
  }

  const rawToken = generateToken();
  await prisma.invitation.create({
    data: {
      contact,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000),
      invitedByAccountId: active.account.id,
      suggestedRole,
      prelinkedSubjectId,
    },
  });

  const acceptUrl = new URL("/api/auth/accept-invitation", getBaseUrl());
  acceptUrl.searchParams.set("token", rawToken);
  await sendInvitationEmail(contact, acceptUrl.toString());

  return NextResponse.redirect(new URL("/admin/invitations", request.url));
}
