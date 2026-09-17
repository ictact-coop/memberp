import { NextResponse } from "next/server";
import { getActiveSession, markSecondFactorVerified } from "@/lib/auth/session";
import { consumeRecoveryCode, verifyTotpForAccount } from "@/lib/auth/totp";

export async function POST(request: Request) {
  const active = await getActiveSession();
  if (!active) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (!active.session.pendingSecondFactor) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const formData = await request.formData();
  const code = formData.get("code");
  const mode = formData.get("mode");

  if (typeof code !== "string") {
    return NextResponse.redirect(new URL("/login/totp?error=1", request.url));
  }

  const verified =
    mode === "recovery"
      ? await consumeRecoveryCode(active.account.id, code)
      : await verifyTotpForAccount(active.account.id, code);

  if (!verified) {
    return NextResponse.redirect(new URL("/login/totp?error=1", request.url));
  }

  await markSecondFactorVerified(active.session.id);
  return NextResponse.redirect(new URL("/", request.url));
}
