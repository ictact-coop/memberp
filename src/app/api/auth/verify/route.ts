import { NextResponse } from "next/server";
import { consumeLoginToken } from "@/lib/auth/login";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(new URL("/login?error=invalid_token", request.url));
  }

  const result = await consumeLoginToken(token);

  switch (result.outcome) {
    case "invalid":
      return NextResponse.redirect(new URL("/login?error=invalid_token", request.url));
    case "needs_totp_setup":
      return NextResponse.redirect(new URL("/login/totp/setup", request.url));
    case "needs_totp_code":
      return NextResponse.redirect(new URL("/login/totp", request.url));
    case "success":
      return NextResponse.redirect(new URL("/", request.url));
  }
}
