import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getActiveSession } from "@/lib/auth/session";
import { hasAnyRole } from "@/lib/auth/roles";
import { isClassificationDomain, normalizeClassificationCode } from "@/lib/classification-labels";

const ADMIN_ROLES = ["SECRETARIAT", "SYSTEM_ADMIN"] as const;

// 분류 등록. 화면(/admin/classifications)에서도 같은 역할을 요구하지만, 폼
// POST는 화면 렌더링을 거치지 않고 바로 올 수 있어 여기서도 다시 확인한다.
export async function POST(request: Request) {
  const active = await getActiveSession();
  if (!active) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (!(await hasAnyRole(active.account.id, [...ADMIN_ROLES]))) {
    return NextResponse.redirect(new URL("/forbidden", request.url));
  }

  const formData = await request.formData();
  const domainRaw = formData.get("domain");
  const codeRaw = formData.get("code");
  const labelRaw = formData.get("label");

  if (typeof domainRaw !== "string" || !isClassificationDomain(domainRaw)) {
    return NextResponse.redirect(new URL("/admin/classifications?error=invalid_domain", request.url));
  }
  if (
    typeof codeRaw !== "string" ||
    !codeRaw.trim() ||
    typeof labelRaw !== "string" ||
    !labelRaw.trim()
  ) {
    return NextResponse.redirect(new URL("/admin/classifications?error=invalid", request.url));
  }

  const code = normalizeClassificationCode(codeRaw);
  const label = labelRaw.trim();

  try {
    await prisma.classification.create({
      data: { domain: domainRaw, code, label, active: true },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.redirect(new URL("/admin/classifications?error=duplicate", request.url));
    }
    throw err;
  }

  return NextResponse.redirect(new URL("/admin/classifications", request.url));
}
