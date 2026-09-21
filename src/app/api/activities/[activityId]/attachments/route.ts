import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveSession } from "@/lib/auth/session";
import {
  ATTACHMENT_MAX_SIZE_BYTES,
  generateAttachmentFileKey,
  isAllowedAttachmentMimeType,
  saveAttachmentFile,
} from "@/lib/attachment-storage";

// 활동 첨부파일 — 기여 증빙(ADR-0004)과 같은 저장 방식을 활동에도 적용한다.
// 계획서·정산 자료 등 활동 자체에 딸린 자료를 위한 것으로, 기여 증빙과는
// entityType(ACTIVITY)만 다르고 나머지 규칙은 같은 원칙(업로더만 다루고,
// 잠긴 상태에서는 추가할 수 없음)을 따른다. 권한은 활동 수정과 같이
// managerAccountId 본인만 — 활동 운영 역할이 있어도 자기 담당이 아니면 안 된다.
export async function POST(request: Request, { params }: { params: Promise<{ activityId: string }> }) {
  const active = await getActiveSession();
  if (!active) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const { activityId } = await params;
  const activity = await prisma.activity.findUnique({ where: { id: activityId } });
  if (!activity) {
    return NextResponse.redirect(new URL("/activities", request.url));
  }
  if (activity.managerAccountId !== active.account.id) {
    return NextResponse.redirect(new URL(`/activities/${activityId}?error=forbidden`, request.url));
  }
  if (activity.status === "CLOSED" || activity.status === "CANCELLED") {
    return NextResponse.redirect(new URL(`/activities/${activityId}?error=locked`, request.url));
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.redirect(
      new URL(`/activities/${activityId}?error=attachment_required`, request.url),
    );
  }
  if (file.size > ATTACHMENT_MAX_SIZE_BYTES) {
    return NextResponse.redirect(
      new URL(`/activities/${activityId}?error=attachment_too_large`, request.url),
    );
  }
  if (!isAllowedAttachmentMimeType(file.type)) {
    return NextResponse.redirect(new URL(`/activities/${activityId}?error=attachment_type`, request.url));
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const fileKey = generateAttachmentFileKey(file.name);
  await saveAttachmentFile(fileKey, buffer);

  await prisma.attachment.create({
    data: {
      entityType: "ACTIVITY",
      entityId: activity.id,
      fileKey,
      fileName: file.name.slice(0, 255),
      mimeType: file.type,
      sizeBytes: buffer.length,
      visibility: "RESTRICTED",
      uploadedByAccountId: active.account.id,
    },
  });

  return NextResponse.redirect(new URL(`/activities/${activityId}`, request.url));
}
