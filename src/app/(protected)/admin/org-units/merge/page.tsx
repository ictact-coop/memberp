import Link from "next/link";
import { requireRole } from "@/lib/auth/roles";
import { prisma } from "@/lib/prisma";

const ERROR_MESSAGES: Record<string, string> = {
  invalid: "합칠 기구 두 곳을 모두 선택하세요.",
  same_subject: "같은 기구를 병합할 수는 없습니다.",
  not_found: "선택한 기구를 확인할 수 없습니다.",
  archived: "보관된 기구는 병합할 수 없습니다. 먼저 복원하세요.",
  account_conflict: "두 기구 모두에 로그인 계정이 연결되어 있어 병합할 수 없습니다.",
};

// 기구 병합 — 동명이인·중복 등록된 기구를 하나로 합친다("아직 없는 것"에
// 남아 있던 틈을 채운다). 실제로 지우는 것이 아니라, 이 기구를 가리키던 모든
// 참조(제기한/대상 상담·수요, 주최한 활동, 참여 배정, 기여, 권한 범위,
// 연결된 로그인 계정)를 남길 기구로 옮긴 뒤, 없앨 기구는 v0.1 §2.1대로
// 보관(archive)만 한다 — 기구 보관·복원과 같은 원칙이다.
export default async function MergeOrgUnitsPage({
  searchParams,
}: {
  searchParams: Promise<{ sourceId?: string; targetId?: string; error?: string }>;
}) {
  await requireRole(["SECRETARIAT", "SYSTEM_ADMIN"]);
  const { sourceId, targetId, error } = await searchParams;

  const orgUnits = await prisma.subject.findMany({
    where: { type: "ORG_UNIT", archivedAt: null },
    orderBy: { name: "asc" },
  });

  // 선택형(GET 폼)은 활성 기구만 보여주므로 정상 사용에서는 항상 이 목록 안에서
  // 고르지만, sourceId===targetId처럼 폼만으로는 못 막는 경우와 URL을 직접 편집한
  // 경우까지 대비해 다시 확인한다.
  let previewError: string | null = null;
  if (sourceId && targetId) {
    if (sourceId === targetId) previewError = "same_subject";
  }
  const source =
    sourceId && targetId && !previewError ? orgUnits.find((o) => o.id === sourceId) : undefined;
  const target =
    sourceId && targetId && !previewError ? orgUnits.find((o) => o.id === targetId) : undefined;
  if (sourceId && targetId && !previewError && (!source || !target)) {
    previewError = "not_found";
  }
  const effectiveError = error ?? previewError ?? undefined;

  const counts =
    source && target
      ? await Promise.all([
          prisma.need.count({ where: { raisedBySubjectId: source.id } }),
          prisma.need.count({ where: { beneficiarySubjectId: source.id } }),
          prisma.activity.count({ where: { organizerSubjectId: source.id } }),
          prisma.activityAssignment.count({ where: { subjectId: source.id } }),
          prisma.contribution.count({ where: { contributorSubjectId: source.id } }),
          prisma.permissionGrant.count({ where: { scopeType: "ORG_UNIT", scopeId: source.id } }),
          prisma.account.count({ where: { subjectId: source.id } }),
        ])
      : null;

  return (
    <section>
      <p style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
        <Link href="/admin/org-units">기구 관리</Link>
      </p>
      <h1 style={{ fontSize: 20 }}>기구 병합</h1>
      {effectiveError && ERROR_MESSAGES[effectiveError] && (
        <p style={{ color: "#c0392b" }}>{ERROR_MESSAGES[effectiveError]}</p>
      )}

      {source && target && counts ? (
        <>
          <p>
            <strong>{source.displayId} · {source.name}</strong>을(를){" "}
            <strong>{target.displayId} · {target.name}</strong>으로 합칩니다.
          </p>
          <div className="card">
            <p style={{ fontWeight: 600, marginTop: 0 }}>
              {source.name}을(를) 가리키던 다음 항목이 {target.name}(으)로 옮겨갑니다
            </p>
            <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.9 }}>
              <li>제기한 상담·수요: {counts[0]}건</li>
              <li>대상(수혜) 상담·수요: {counts[1]}건</li>
              <li>주최한 활동: {counts[2]}건</li>
              <li>참여 배정: {counts[3]}건</li>
              <li>기여: {counts[4]}건</li>
              <li>권한 범위(역할 부여): {counts[5]}건</li>
              <li>연결된 로그인 계정: {counts[6]}개</li>
            </ul>
            <p style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
              {source.name} 자체의 이름·지역·전문영역 등 정보는 옮겨지지 않습니다 — 필요하면
              합치기 전에 {target.name} 쪽 정보를 직접 고쳐두세요. 병합 후 {source.name}은(는)
              삭제되지 않고 보관(archive) 처리됩니다.
            </p>
          </div>
          <form method="POST" action="/api/admin/org-units/merge" style={{ marginTop: 16 }}>
            <input type="hidden" name="sourceId" value={source.id} />
            <input type="hidden" name="targetId" value={target.id} />
            <button type="submit" style={{ padding: "10px 16px", fontSize: 16 }}>
              병합 확정
            </button>{" "}
            <Link href="/admin/org-units/merge" className="btn-outline" style={{ padding: "10px 16px" }}>
              취소
            </Link>
          </form>
        </>
      ) : (
        <form method="GET" action="/admin/org-units/merge" className="card">
          <label htmlFor="sourceId" style={{ display: "block", fontSize: 14, marginBottom: 4 }}>
            병합할 기구 (없앨 쪽 — 보관 처리됨)
          </label>
          <select
            id="sourceId"
            name="sourceId"
            required
            style={{ width: "100%", padding: 10, fontSize: 16, marginBottom: 12 }}
          >
            <option value="">선택하세요</option>
            {orgUnits.map((orgUnit) => (
              <option key={orgUnit.id} value={orgUnit.id}>
                {orgUnit.displayId} · {orgUnit.name}
              </option>
            ))}
          </select>

          <label htmlFor="targetId" style={{ display: "block", fontSize: 14, marginBottom: 4 }}>
            합칠 대상 기구 (남길 쪽)
          </label>
          <select
            id="targetId"
            name="targetId"
            required
            style={{ width: "100%", padding: 10, fontSize: 16, marginBottom: 16 }}
          >
            <option value="">선택하세요</option>
            {orgUnits.map((orgUnit) => (
              <option key={orgUnit.id} value={orgUnit.id}>
                {orgUnit.displayId} · {orgUnit.name}
              </option>
            ))}
          </select>

          <button type="submit" style={{ padding: "10px 16px", fontSize: 16 }}>
            다음 (미리보기)
          </button>
        </form>
      )}
    </section>
  );
}
