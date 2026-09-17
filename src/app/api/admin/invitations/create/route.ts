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
// 사무국이 미리 확인한 사람(Subject)에 연결하는 기능은 아직 없다 — 주체를 찾아
// 고르는 화면이 없어서다. 지금은 계정 생성 시 자동으로 최소 정보의 주체를 만든다
// (accept-invitation route 참고).
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

  const rawToken = generateToken();
  await prisma.invitation.create({
    data: {
      contact,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000),
      invitedByAccountId: active.account.id,
      suggestedRole,
    },
  });

  const acceptUrl = new URL("/api/auth/accept-invitation", getBaseUrl());
  acceptUrl.searchParams.set("token", rawToken);
  await sendInvitationEmail(contact, acceptUrl.toString());

  return NextResponse.redirect(new URL("/admin/invitations", request.url));
}
