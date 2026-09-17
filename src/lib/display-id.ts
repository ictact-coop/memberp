import type { Prisma } from "@prisma/client";

// ACT-0001, SUB-0001처럼 사람이 찾는 번호를 접두사별로 원자적으로 채번한다.
// upsert 하나로 처리해 동시 요청에도 중복이 생기지 않는다.
export async function nextDisplayId(
  tx: Prisma.TransactionClient,
  prefix: string,
): Promise<string> {
  const sequence = await tx.displaySequence.upsert({
    where: { prefix },
    create: { prefix, lastValue: 1 },
    update: { lastValue: { increment: 1 } },
  });
  return `${prefix}-${String(sequence.lastValue).padStart(4, "0")}`;
}
