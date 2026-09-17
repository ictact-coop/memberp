import { NextResponse } from "next/server";
import type { PermissionRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getActiveSession } from "@/lib/auth/session";
import { hasAnyRole } from "@/lib/auth/roles";
import { generateToken, hashToken } from "@/lib/auth/crypto";
import { getBaseUrl, INVITATION_TTL_DAYS } from "@/lib/auth/config";
import { sendInvitationEmail } from "@/lib/email/resend";

const ADMIN_ROLES: PermissionRole[] = ["SECRETARIAT", "SYSTEM_ADMIN"];

// 새 토큰을 발급하고 만료일을 다시 늘려서 재발송한다 — 같은 초대장 레코드를 재사용해
// 초대 이력이 중복 레코드로 흩어지지 않게 한다.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const active = await getActiveSession();
  if (!active) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (!(await hasAnyRole(active.account.id, ADMIN_ROLES))) {
    return NextResponse.redirect(new URL("/forbidden", request.url));
  }

  const { id } = await params;
  const invitation = await prisma.invitation.findUnique({ where: { id } });
  if (!invitation || invitation.status !== "PENDING") {
    return NextResponse.redirect(new URL("/admin/invitations", request.url));
  }

  const rawToken = generateToken();
  await prisma.invitation.update({
    where: { id: invitation.id },
    data: {
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000),
    },
  });

  const acceptUrl = new URL("/api/auth/accept-invitation", getBaseUrl());
  acceptUrl.searchParams.set("token", rawToken);
  await sendInvitationEmail(invitation.contact, acceptUrl.toString());

  return NextResponse.redirect(new URL("/admin/invitations", request.url));
}
