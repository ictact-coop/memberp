import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Supabase 무료 플랜은 DB에 실제 쓰기가 1주일 넘게 없으면 프로젝트를 일시정지한다
// (연결·조회만으로는 "활동"으로 안 쳐준다). Vercel Cron(vercel.json의 crons)이
// 매일 이 라우트를 호출해 실제 UPDATE를 하나 발생시킨다.
export async function GET(request: Request) {
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== expected) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const pingedAt = new Date();
  await prisma.systemHeartbeat.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", pingedAt },
    update: { pingedAt },
  });

  return NextResponse.json({ ok: true, pingedAt: pingedAt.toISOString() });
}
