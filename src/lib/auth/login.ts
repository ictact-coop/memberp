import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { sendLoginEmail } from "@/lib/email/resend";
import { generateToken, hashToken } from "./crypto";
import { createSession } from "./session";
import { hasAnyRole } from "./roles";
import { ELEVATED_ROLES, LOGIN_TOKEN_TTL_MINUTES } from "./config";

function getBaseUrl(): string {
  const url = process.env.APP_BASE_URL;
  if (!url) {
    throw new Error("APP_BASE_URL 환경변수가 설정되지 않았습니다.");
  }
  return url;
}

export async function requestLoginLink(rawEmail: string): Promise<void> {
  const email = rawEmail.trim().toLowerCase();
  const account = await prisma.account.findUnique({ where: { email } });

  // 계정이 없거나 활성 상태가 아니어도 겉으로는 성공한 것과 똑같이 동작한다 —
  // 이메일 등록 여부를 외부에 노출하지 않기 위함이다.
  if (!account || account.status !== "ACTIVE") {
    return;
  }

  const headerList = await headers();
  const rawToken = generateToken();
  await prisma.loginToken.create({
    data: {
      accountId: account.id,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + LOGIN_TOKEN_TTL_MINUTES * 60 * 1000),
      requestedIp: headerList.get("x-forwarded-for") ?? undefined,
      requestedUserAgent: headerList.get("user-agent") ?? undefined,
    },
  });

  const verifyUrl = new URL("/api/auth/verify", getBaseUrl());
  verifyUrl.searchParams.set("token", rawToken);
  await sendLoginEmail(email, verifyUrl.toString());
}

export type ConsumeLoginTokenResult =
  | { outcome: "invalid" }
  | { outcome: "needs_totp_setup" }
  | { outcome: "needs_totp_code" }
  | { outcome: "success" };

export async function consumeLoginToken(rawToken: string): Promise<ConsumeLoginTokenResult> {
  const loginToken = await prisma.loginToken.findUnique({
    where: { tokenHash: hashToken(rawToken) },
    include: { account: true },
  });

  if (!loginToken || loginToken.consumedAt || loginToken.expiresAt < new Date()) {
    return { outcome: "invalid" };
  }
  if (loginToken.account.status !== "ACTIVE") {
    return { outcome: "invalid" };
  }

  await prisma.loginToken.update({
    where: { id: loginToken.id },
    data: { consumedAt: new Date() },
  });

  const requiresTotp = await hasAnyRole(loginToken.accountId, ELEVATED_ROLES);
  const hasTotpEnrolled = loginToken.account.totpEnabledAt !== null;

  const headerList = await headers();
  await createSession({
    accountId: loginToken.accountId,
    pendingSecondFactor: requiresTotp,
    userAgent: headerList.get("user-agent"),
    ipAddress: headerList.get("x-forwarded-for"),
  });
  await prisma.account.update({
    where: { id: loginToken.accountId },
    data: { lastLoginAt: new Date() },
  });

  if (!requiresTotp) return { outcome: "success" };
  return hasTotpEnrolled ? { outcome: "needs_totp_code" } : { outcome: "needs_totp_setup" };
}
