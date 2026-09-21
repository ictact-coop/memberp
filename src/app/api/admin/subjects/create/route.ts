import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveSession } from "@/lib/auth/session";
import { hasAnyRole } from "@/lib/auth/roles";
import { nextDisplayId } from "@/lib/display-id";
import { isAllowedControlledValue } from "@/lib/classification-labels";

const ADMIN_ROLES = ["SECRETARIAT", "SYSTEM_ADMIN"] as const;

// 사람 미리 등록. 계정 없는 Subject(type=PERSON)를 만든다 — 기구 등록과 같은
// 원칙(지역·전문영역은 분류표 기반 선택형)이지만, 책임 담당자·공개범위 같은
// 기구 전용 필드는 없다. 상태는 항상 NEEDS_CONFIRMATION으로 시작한다.
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
  const expertiseTagValues = formData.getAll("expertiseTags");
  const contactRaw = formData.get("contact");

  if (typeof nameRaw !== "string" || !nameRaw.trim()) {
    return NextResponse.redirect(new URL("/admin/subjects/new?error=invalid", request.url));
  }
  const name = nameRaw.trim();

  const [regionOptions, expertiseOptions] = await Promise.all([
    prisma.classification.findMany({ where: { domain: "REGION", active: true }, select: { label: true } }),
    prisma.classification.findMany({ where: { domain: "EXPERTISE", active: true }, select: { label: true } }),
  ]);
  const allowedRegions = new Set(regionOptions.map((o) => o.label));
  const allowedExpertise = new Set(expertiseOptions.map((o) => o.label));

  const region = typeof regionRaw === "string" && regionRaw.trim() ? regionRaw.trim() : null;
  if (region && !isAllowedControlledValue(region, allowedRegions, new Set())) {
    return NextResponse.redirect(new URL("/admin/subjects/new?error=invalid_region", request.url));
  }
  const expertiseTags = Array.from(
    new Set(expertiseTagValues.filter((v): v is string => typeof v === "string" && v.trim() !== "")),
  );
  if (expertiseTags.some((tag) => !isAllowedControlledValue(tag, allowedExpertise, new Set()))) {
    return NextResponse.redirect(new URL("/admin/subjects/new?error=invalid_expertise_tag", request.url));
  }

  const contact = typeof contactRaw === "string" && contactRaw.trim() ? contactRaw.trim() : null;
  const contactInfo = contact ? { value: contact } : null;

  const subject = await prisma.$transaction(async (tx) => {
    const displayId = await nextDisplayId(tx, "SUB");
    return tx.subject.create({
      data: {
        displayId,
        type: "PERSON",
        name,
        region,
        expertiseTags,
        contactInfo: contactInfo ?? undefined,
        status: "NEEDS_CONFIRMATION",
        createdBy: active.account.id,
      },
    });
  });

  return NextResponse.redirect(
    new URL(`/admin/invitations?prelinked=${subject.id}`, request.url),
  );
}
