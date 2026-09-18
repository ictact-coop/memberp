import { NextResponse } from "next/server";
import { Visibility } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getActiveSession } from "@/lib/auth/session";
import { hasAnyRole } from "@/lib/auth/roles";

const ADMIN_ROLES = ["SECRETARIAT", "SYSTEM_ADMIN"] as const;

// 기구 정보 수정. 등록(create)과 같은 필드·검증을 쓴다. 내 정보 수정과 같은
// 원칙으로, 이름이 바뀌면 옛 이름을 previousNames에 남긴다.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const active = await getActiveSession();
  if (!active) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (!(await hasAnyRole(active.account.id, [...ADMIN_ROLES]))) {
    return NextResponse.redirect(new URL("/forbidden", request.url));
  }

  const { id } = await params;
  const orgUnit = await prisma.subject.findUnique({ where: { id } });
  if (!orgUnit || orgUnit.type !== "ORG_UNIT") {
    return NextResponse.redirect(new URL("/admin/org-units", request.url));
  }

  const formData = await request.formData();
  const nameRaw = formData.get("name");
  const regionRaw = formData.get("region");
  const expertiseTagsRaw = formData.get("expertiseTags");
  const responsibleAccountIdRaw = formData.get("responsibleAccountId");
  const visibilityRaw = formData.get("visibility");

  if (typeof nameRaw !== "string" || !nameRaw.trim()) {
    return NextResponse.redirect(new URL(`/admin/org-units/${id}/edit?error=invalid`, request.url));
  }
  const name = nameRaw.trim();

  const responsibleAccountId =
    typeof responsibleAccountIdRaw === "string" && responsibleAccountIdRaw
      ? responsibleAccountIdRaw
      : null;
  if (responsibleAccountId) {
    const responsible = await prisma.account.findUnique({ where: { id: responsibleAccountId } });
    if (!responsible) {
      return NextResponse.redirect(
        new URL(`/admin/org-units/${id}/edit?error=invalid_responsible`, request.url),
      );
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

  const previousNames =
    orgUnit.name !== name && orgUnit.name && !orgUnit.previousNames.includes(orgUnit.name)
      ? [...orgUnit.previousNames, orgUnit.name]
      : orgUnit.previousNames;

  await prisma.$transaction(async (tx) => {
    await tx.subject.update({
      where: { id },
      data: {
        name,
        previousNames,
        region,
        expertiseTags,
        responsibleAccountId,
        visibility,
        updatedBy: active.account.id,
      },
    });
    await tx.auditLog.create({
      data: {
        entityType: "Subject",
        entityId: id,
        action: "UPDATE",
        actorAccountId: active.account.id,
        beforeData: {
          name: orgUnit.name,
          region: orgUnit.region,
          expertiseTags: orgUnit.expertiseTags,
          responsibleAccountId: orgUnit.responsibleAccountId,
          visibility: orgUnit.visibility,
        },
        afterData: { name, region, expertiseTags, responsibleAccountId, visibility },
      },
    });
  });

  return NextResponse.redirect(new URL("/admin/org-units", request.url));
}
