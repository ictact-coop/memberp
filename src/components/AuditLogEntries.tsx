import Link from "next/link";
import type { AuditLog } from "@prisma/client";
import { AUDIT_ACTION_LABELS, diffAuditData } from "@/lib/audit-labels";

function formatDateTime(date: Date): string {
  return date.toISOString().slice(0, 16).replace("T", " ");
}

function entityLink(type: string, id: string): string | null {
  if (type === "Activity") return `/activities/${id}`;
  if (type === "Need") return `/needs/${id}`;
  return null;
}

// 상태 이력 조회(관리자 전용)와 내 담당 이력(누구나, 자기 담당 항목만)이
// 같은 방식으로 로그를 보여준다 — 필터링만 다르므로 렌더링을 공유한다.
export function AuditLogEntries({
  logs,
  actorLabelById,
}: {
  logs: AuditLog[];
  actorLabelById: Map<string, string>;
}) {
  if (logs.length === 0) {
    return <p style={{ color: "#555555" }}>조건에 맞는 이력이 없습니다.</p>;
  }

  return (
    <ul style={{ listStyle: "none", padding: 0 }}>
      {logs.map((log) => {
        const diffs = diffAuditData(log.beforeData, log.afterData);
        const link = entityLink(log.entityType, log.entityId);
        return (
          <li key={log.id} style={{ borderBottom: "1px solid #e0e0e0", padding: "12px 0" }}>
            <div style={{ fontSize: 12, color: "#888888" }}>
              {formatDateTime(log.occurredAt)} ·{" "}
              {log.actorAccountId ? (actorLabelById.get(log.actorAccountId) ?? log.actorAccountId) : "시스템"}
            </div>
            <div>
              <strong>{AUDIT_ACTION_LABELS[log.action]}</strong> · {log.entityType}{" "}
              {link ? (
                <Link href={link} style={{ fontSize: 12 }}>
                  {log.entityId.slice(0, 8)}…
                </Link>
              ) : (
                <span style={{ fontSize: 12, color: "#888888" }}>{log.entityId.slice(0, 8)}…</span>
              )}
            </div>
            {diffs.length > 0 && (
              <ul style={{ fontSize: 12, color: "#555555", marginTop: 4, paddingLeft: 16 }}>
                {diffs.map((diff) => (
                  <li key={diff.key}>
                    {diff.key}: {diff.before} → {diff.after}
                  </li>
                ))}
              </ul>
            )}
            {log.reason && (
              <div style={{ fontSize: 12, color: "#555555", marginTop: 4 }}>사유: {log.reason}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
