import { NextResponse } from "next/server";
import { Visibility } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getActiveSession } from "@/lib/auth/session";
import { hasAnyRole } from "@/lib/auth/roles";
import { nextDisplayId } from "@/lib/display-id";

const ADMIN_ROLES = ["SECRETARIAT", "SYSTEM_ADMIN"] as const;

// 기구(Subject type=ORG_UNIT) 등록. 화면(/admin/org-units)에서도 같은 역할을
// 요구하지만, 폼 POST는 화면 렌더링을 거치지 않고 바로 올 수 있어 여기서도 다시
// 확인한다(다른 /api/admin/* 라우트와 같은 원칙).
export async function POST(request: Request) {
  const active = await getActiveSession();
  if (!active) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (!(await hasAnyRole(active.account.id, [...ADMIN_ROLES]))) {
    return NextResponse.redirect(new URL("/forbidden", request.url));
  }

  const formData = await request.formData();
  const nameRaw = formData.get("name");
  const regionRaw = formData.get("region");
  const expertiseTagsRaw = formData.get("expertiseTags");
  const responsibleAccountIdRaw = formData.get("responsibleAccountId");
  const visibilityRaw = formData.get("visibility");

  if (typeof nameRaw !== "string" || !nameRaw.trim()) {
    return NextResponse.redirect(new URL("/admin/org-units?error=invalid", request.url));
  }
  const name = nameRaw.trim();

  const responsibleAccountId =
    typeof responsibleAccountIdRaw === "string" && responsibleAccountIdRaw
      ? responsibleAccountIdRaw
      : null;
  if (responsibleAccountId) {
    const responsible = await prisma.account.findUnique({ where: { id: responsibleAccountId } });
    if (!responsible) {
      return NextResponse.redirect(new URL("/admin/org-units?error=invalid_responsible", request.url));
    }
  }

  const region = typeof regionRaw === "string" && regionRaw.trim() ? regionRaw.trim() : null;
  const expertiseTags =
    typeof expertiseTagsRaw === "string"
      ? Array.from(new Set(expertiseTagsRaw.split(",").map((tag) => tag.trim()).filter(Boolean)))
      : [];
  const visibility: Visibility =
    typeof visibilityRaw === "string" && (Object.values(Visibility) as string[]).includes(visibilityRaw)
      ? (visibilityRaw as Visibility)
      : "TEAM";

  await prisma.$transaction(async (tx) => {
    const displayId = await nextDisplayId(tx, "SUB");
    await tx.subject.create({
      data: {
        displayId,
        type: "ORG_UNIT",
        name,
        region,
        expertiseTags,
        responsibleAccountId,
        visibility,
        status: "ACTIVE",
        createdBy: active.account.id,
      },
    });
  });

  return NextResponse.redirect(new URL("/admin/org-units", request.url));
}
