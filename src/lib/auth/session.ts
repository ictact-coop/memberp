import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Account } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateToken, hashToken } from "./crypto";
import { SESSION_COOKIE_NAME, SESSION_TTL_DAYS } from "./config";

type CreateSessionInput = {
  accountId: string;
  pendingSecondFactor: boolean;
  userAgent?: string | null;
  ipAddress?: string | null;
};

export async function createSession(input: CreateSessionInput) {
  const rawToken = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

  const session = await prisma.session.create({
    data: {
      accountId: input.accountId,
      sessionTokenHash: hashToken(rawToken),
      pendingSecondFactor: input.pendingSecondFactor,
      expiresAt,
      userAgent: input.userAgent ?? undefined,
      ipAddress: input.ipAddress ?? undefined,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, rawToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });

  return session;
}

export type ActiveSession = {
  session: { id: string; pendingSecondFactor: boolean };
  account: Account;
};

// 매 요청마다 계정 상태까지 함께 확인한다 — FR-01 "탈퇴·중지 계정 접근 차단"은
// 세션을 지우는 시점이 아니라 다음 요청이 들어오는 시점에 반영되어야 하기 때문이다.
export async function getActiveSession(): Promise<ActiveSession | null> {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!rawToken) return null;

  const session = await prisma.session.findUnique({
    where: { sessionTokenHash: hashToken(rawToken) },
    include: { account: true },
  });

  if (!session || session.revokedAt || session.expiresAt < new Date()) {
    return null;
  }
  if (session.account.status !== "ACTIVE") {
    return null;
  }

  // 매 요청마다 쓰기를 발생시키지 않도록 5분에 한 번만 활동 시각을 갱신한다.
  if (Date.now() - session.lastUsedAt.getTime() > 5 * 60 * 1000) {
    await prisma.session.update({
      where: { id: session.id },
      data: { lastUsedAt: new Date() },
    });
  }

  const { account, ...rest } = session;
  return { session: rest, account };
}

// (protected) 레이아웃이 이미 세션 존재와 2단계 인증 완료를 확인했다는 전제로 쓰는
// 헬퍼 — 그 아래 화면에서 매번 null 체크를 반복하지 않기 위함이다. 로그인 화면처럼
// "세션이 없을 수도 있다"를 직접 다뤄야 하는 곳은 getActiveSession을 그대로 쓴다.
export async function requireActiveSession(): Promise<ActiveSession> {
  const active = await getActiveSession();
  if (!active) {
    redirect("/login");
  }
  return active;
}

export async function markSecondFactorVerified(sessionId: string) {
  await prisma.session.update({
    where: { id: sessionId },
    data: { pendingSecondFactor: false },
  });
}

export async function revokeCurrentSession() {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (rawToken) {
    await prisma.session.updateMany({
      where: { sessionTokenHash: hashToken(rawToken) },
      data: { revokedAt: new Date() },
    });
  }
  cookieStore.delete(SESSION_COOKIE_NAME);
}

// 사무국이 계정을 정지·탈퇴 처리할 때 호출한다 — 세션 만료를 기다리지 않고 즉시 끊는다.
export async function revokeAllSessionsForAccount(accountId: string) {
  await prisma.session.updateMany({
    where: { accountId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
