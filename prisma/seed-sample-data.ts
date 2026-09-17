import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// 활동을 만드는 관리자 화면이 아직 없어(다음 작업), 로그인·기여 작성·담당자 확인
// 흐름을 체험해보는 용도로 최소한의 활동 1건과 상담·수요 1건을 만든다.
// 사용법: npx tsx prisma/seed-sample-data.ts <담당자로 지정할 계정 이메일>
async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("사용법: npx tsx prisma/seed-sample-data.ts <담당자 계정 이메일>");
    process.exit(1);
  }

  const manager = await prisma.account.findUnique({ where: { email: email.toLowerCase() } });
  if (!manager) {
    console.error(`계정을 찾을 수 없습니다: ${email} (먼저 초대를 수락해 계정을 만드세요)`);
    process.exit(1);
  }

  const activity = await prisma.activity.create({
    data: {
      displayId: `ACT-DEMO-${Date.now()}`,
      title: "지역단체 PC 정비 지원 (샘플)",
      managementType: "BUSINESS",
      missions: ["SHARED_RESOURCE_EXPANSION"],
      purpose: "PC 장애 해결 및 재사용 — 체험용 샘플 활동입니다.",
      managerAccountId: manager.id,
      status: "IN_PROGRESS",
    },
  });

  const need = await prisma.need.create({
    data: {
      displayId: `NEED-DEMO-${Date.now()}`,
      title: "디지털 기기 활용 상담 (샘플)",
      content: "체험용 샘플 상담·수요입니다.",
      channel: "PHONE",
      receivedAt: new Date(),
      assigneeAccountId: manager.id,
      status: "REVIEWING",
    },
  });

  console.log(`샘플 활동 생성: ${activity.displayId} (${activity.title})`);
  console.log(`샘플 상담 생성: ${need.displayId} (${need.title})`);
  console.log(`담당자: ${email} — 이 계정으로 /review에서 확인할 수 있습니다.`);
  console.log("기여는 다른 계정으로 /my/contributions/new 에서 작성해야 자가확인 제한에");
  console.log("걸리지 않고 /review에서 확인 버튼을 테스트할 수 있습니다.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
