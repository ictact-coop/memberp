import type { Prisma, NotificationType } from "@prisma/client";

type NotifyInput = {
  accountId: string;
  type: NotificationType;
  title: string;
  body?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
};

// FR-10 앱 내 알림. 이메일 발송(ADR-0003)과는 별개의 통로다 — 지금은 큐를 거치지
// 않고 이벤트를 일으킨 요청의 트랜잭션 안에서 바로 만든다(그래서 status를 항상
// SENT로 채운다: "PENDING → 발송 시도"라는 중간 단계가 없다). PENDING/FAILED는
// 나중에 이메일 등 외부 채널로도 보내는 실제 발송 계층이 생기면 쓸 자리로
// 남겨둔다.
export async function notify(
  tx: Pick<Prisma.TransactionClient, "notification">,
  input: NotifyInput,
): Promise<void> {
  await tx.notification.create({
    data: {
      accountId: input.accountId,
      type: input.type,
      title: input.title,
      body: input.body,
      relatedEntityType: input.relatedEntityType,
      relatedEntityId: input.relatedEntityId,
      status: "SENT",
      sentAt: new Date(),
    },
  });
}
