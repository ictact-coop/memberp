import type { AuditAction } from "@prisma/client";

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  CREATE: "생성",
  UPDATE: "수정",
  DELETE: "삭제",
  STATUS_CHANGE: "상태 변경",
  CONFIRM: "확인",
  ARCHIVE: "보관",
};

// beforeData/afterData(JSON) 중 실제로 값이 달라진 키만 뽑아 "무엇이 바뀌었는지"를
// 간단히 보여준다 — 두 값 다 있는데 같으면 표시하지 않는다.
export function diffAuditData(
  before: unknown,
  after: unknown,
): { key: string; before: string; after: string }[] {
  const beforeObj = before && typeof before === "object" ? (before as Record<string, unknown>) : {};
  const afterObj = after && typeof after === "object" ? (after as Record<string, unknown>) : {};
  const keys = new Set([...Object.keys(beforeObj), ...Object.keys(afterObj)]);

  const formatValue = (value: unknown): string => {
    if (value === undefined) return "(없음)";
    if (value === null) return "null";
    if (Array.isArray(value)) return value.length ? value.join(", ") : "(빈 목록)";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  };

  return Array.from(keys)
    .filter((key) => JSON.stringify(beforeObj[key]) !== JSON.stringify(afterObj[key]))
    .map((key) => ({ key, before: formatValue(beforeObj[key]), after: formatValue(afterObj[key]) }));
}
