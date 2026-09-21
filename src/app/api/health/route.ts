import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// 배포 환경의 헬스체크(Docker healthcheck 등)와 관측(v1.0 §10 "관측") 용도.
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", db: "ok" });
  } catch {
    return NextResponse.json({ status: "error", db: "unreachable" }, { status: 503 });
  }
}
