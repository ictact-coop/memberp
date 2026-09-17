import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveSession } from "@/lib/auth/session";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const active = await getActiveSession();
  if (!active) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const { id } = await params;
  const formData = await request.formData();
  const reason = formData.get("reason");

  const contribution = await prisma.contribution.findUnique({
    where: { id },
    include: { activity: true, need: true },
  });
  if (!contribution) {
    return NextResponse.redirect(new URL("/review", request.url));
  }

  const isManager =
    contribution.activity?.managerAccountId === active.account.id ||
    contribution.need?.assigneeAccountId === active.account.id;
  if (!isManager) {
    return NextResponse.redirect(new URL("/review?error=forbidden", request.url));
  }
  if (contribution.status !== "SUBMITTED") {
    return NextResponse.redirect(new URL("/review", request.url));
  }

  await prisma.contribution.update({
    where: { id: contribution.id },
    data: {
      status: "NEEDS_REVISION",
      revisionReason: typeof reason === "string" && reason.trim() ? reason.trim() : null,
    },
  });

  return NextResponse.redirect(new URL("/review", request.url));
}
