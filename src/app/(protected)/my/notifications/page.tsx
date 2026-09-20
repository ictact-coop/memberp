import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireActiveSession } from "@/lib/auth/session";
import { NOTIFICATION_TYPE_LABELS } from "@/lib/notification-labels";

function formatDateTime(date: Date): string {
  return date.toISOString().slice(0, 16).replace("T", " ");
}

function relatedLink(type: string | null, id: string | null): string | null {
  if (!type || !id) return null;
  if (type === "Activity") return `/activities/${id}`;
  if (type === "Need") return `/needs/${id}`;
  if (type === "Contribution") return `/my/contributions/new?id=${id}`;
  return null;
}

// 알림 — FR-10 "보완요청·확인결과·배정변경을 앱 안에서 확인". Notification
// 모델은 R1 스키마 설계 때부터 있었지만 이번에 처음 실제로 채운다. 이메일
// 발송(ADR-0003)과 달리 큐를 거치지 않고, 이벤트를 일으킨 요청 안에서 바로
// 만든다(src/lib/notifications.ts) — 이 화면은 그렇게 쌓인 것을 보여줄 뿐이다.
export default async function MyNotificationsPage() {
  const active = await requireActiveSession();

  const notifications = await prisma.notification.findMany({
    where: { accountId: active.account.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const unreadCount = notifications.filter((n) => n.status !== "READ").length;

  return (
    <section>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>알림</h1>
      <p style={{ color: "var(--color-text-muted)", fontSize: 13, marginTop: 0 }}>
        보완 요청·기여 확인·참여 배정 변경·상담·수요 배정 소식을 모아 봅니다.
      </p>

      {unreadCount > 0 && (
        <form method="POST" action="/api/notifications/read-all" style={{ marginBottom: 16 }}>
          <button type="submit" className="btn-outline" style={{ padding: "8px 14px", fontSize: 14 }}>
            모두 읽음으로 표시 ({unreadCount})
          </button>
        </form>
      )}

      {notifications.length === 0 ? (
        <p className="card" style={{ color: "var(--color-text-muted)" }}>
          아직 온 알림이 없습니다.
        </p>
      ) : (
        <ul className="card-list">
          {notifications.map((notification) => {
            const isUnread = notification.status !== "READ";
            const link = relatedLink(notification.relatedEntityType, notification.relatedEntityId);
            return (
              <li key={notification.id} className="card">
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 12,
                    color: "var(--color-text-muted)",
                  }}
                >
                  <span className="badge badge-blue">{NOTIFICATION_TYPE_LABELS[notification.type]}</span>
                  <span>{formatDateTime(notification.createdAt)}</span>
                  {isUnread && <span style={{ color: "var(--color-danger)", fontWeight: 600 }}>· 안 읽음</span>}
                </div>
                <div style={{ fontWeight: isUnread ? 700 : 400, margin: "4px 0" }}>
                  {link ? <Link href={link}>{notification.title}</Link> : notification.title}
                </div>
                {notification.body && (
                  <div style={{ fontSize: 13, color: "var(--color-text-muted)" }}>{notification.body}</div>
                )}
                {isUnread && (
                  <form method="POST" action={`/api/notifications/${notification.id}/read`} style={{ marginTop: 8 }}>
                    <button type="submit" className="btn-outline" style={{ fontSize: 12, padding: "4px 10px" }}>
                      읽음으로 표시
                    </button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
