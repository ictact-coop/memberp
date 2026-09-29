import Link from "next/link";

// 상태 이력 조회·내 담당 이력 공통 페이지 이동 UI. entityType/entityId 같은
// 필터는 그대로 유지한 채 page만 바꿔야 하므로, href 조립은 호출하는 화면이
// (자신의 필터 쿼리스트링을 알고 있는) buildHref로 넘긴다.
export function AuditLogPagination({
  page,
  pageSize,
  total,
  buildHref,
}: {
  page: number;
  pageSize: number;
  total: number;
  buildHref: (page: number) => string;
}) {
  if (total === 0) return null;

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 16, fontSize: 13 }}>
      {page > 1 ? (
        <Link href={buildHref(page - 1)}>← 이전</Link>
      ) : (
        <span style={{ color: "var(--color-text-muted)" }}>← 이전</span>
      )}
      <span style={{ color: "var(--color-text-muted)" }}>
        {from}–{to} / 총 {total}건 ({page}/{totalPages}페이지)
      </span>
      {page < totalPages ? (
        <Link href={buildHref(page + 1)}>다음 →</Link>
      ) : (
        <span style={{ color: "var(--color-text-muted)" }}>다음 →</span>
      )}
    </div>
  );
}
