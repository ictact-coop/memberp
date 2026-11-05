import type { AuditAction } from "@prisma/client";

// 상태 이력 조회(/admin/audit-log)·내 담당 이력(/my/audit-log) 공통 페이지
// 크기 — 둘 다 "최근 200건만" 보여주고 더 과거로 갈 방법이 없던 것을 고친다.
export const AUDIT_LOG_PAGE_SIZE = 50;

// page 쿼리 파라미터를 안전하게 정수로 바꾼다 — 없거나, 숫자가 아니거나,
// 0 이하이면 1페이지로 취급한다(음수·소수·문자열 등 잘못된 값으로 skip에
// 이상한 수를 넘기지 않기 위함).
export function parseAuditLogPage(raw: string | undefined): number {
  const n = raw ? Number(raw) : 1;
  return Number.isInteger(n) && n > 0 ? n : 1;
}

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  CREATE: "생성",
  UPDATE: "수정",
  DELETE: "삭제",
  STATUS_CHANGE: "상태 변경",
  CONFIRM: "확인",
  ARCHIVE: "보관",
  EXPORT: "내보내기",
  IMPORT: "복원",
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
