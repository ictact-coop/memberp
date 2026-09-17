import { NextResponse } from "next/server";
import { requestLoginLink } from "@/lib/auth/login";

export async function POST(request: Request) {
  const formData = await request.formData();
  const email = formData.get("email");

  if (typeof email !== "string" || !email.includes("@")) {
    return NextResponse.redirect(new URL("/login?error=invalid_email", request.url));
  }

  await requestLoginLink(email);

  const redirectUrl = new URL("/login/check-email", request.url);
  redirectUrl.searchParams.set("email", email);
  return NextResponse.redirect(redirectUrl);
}
