import Link from "next/link";
import { requireRole } from "@/lib/auth/roles";
import { prisma } from "@/lib/prisma";
import { countSubjectReferences } from "@/lib/subject-merge";

const ERROR_MESSAGES: Record<string, string> = {
  invalid: "합칠 사람 두 명을 모두 선택하세요.",
  same_subject: "같은 사람을 병합할 수는 없습니다.",
  not_found: "선택한 사람을 확인할 수 없습니다.",
  archived: "보관된 사람은 병합할 수 없습니다.",
  account_conflict:
    "두 사람 모두에 로그인 계정이 연결되어 있어 병합할 수 없습니다. 둘 중 하나가 실제로는 계정이 필요 없는 중복이라면, 그 계정을 정지 처리한 뒤 다시 시도하세요.",
};

// 사람 주체 병합 — 동명이인이거나 중복 등록된 사람 두 건을 하나로 합친다
// ("아직 없는 것"의 "사람 주체 동명이인·중복 정리"). 기구 병합과 원리는
// 같지만(src/lib/subject-merge.ts 공유), 사람은 로그인 계정이 걸려 있는 게
// 정상이라 "둘 다 계정이 있으면 병합 금지"에 실제로 자주 걸린다 — 이 경우는
// 두 로그인 정체성 중 무엇을 남길지 조합의 판단이 필요한 문제라 이 화면의
// 범위를 넘는다(§"정직하게 남겨둔 것" 참고).
export default async function MergeSubjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ sourceId?: string; targetId?: string; error?: string }>;
}) {
  await requireRole(["SECRETARIAT", "SYSTEM_ADMIN"]);
  const { sourceId, targetId, error } = await searchParams;

  const people = await prisma.subject.findMany({
    where: { type: "PERSON", archivedAt: null },
    include: { account: { select: { email: true, phone: true } } },
    orderBy: { name: "asc" },
  });

  let previewError: string | null = null;
  if (sourceId && targetId) {
    if (sourceId === targetId) previewError = "same_subject";
  }
  const source =
    sourceId && targetId && !previewError ? people.find((p) => p.id === sourceId) : undefined;
  const target =
    sourceId && targetId && !previewError ? people.find((p) => p.id === targetId) : undefined;
  if (sourceId && targetId && !previewError && (!source || !target)) {
    previewError = "not_found";
  }
  const effectiveError = error ?? previewError ?? undefined;

  const counts = source && target ? await countSubjectReferences(prisma, source.id) : null;

  const accountLabel = (person: (typeof people)[number]) =>
    person.account ? person.account.email ?? person.account.phone ?? "있음" : "없음";

  return (
    <section>
      <p style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
        <Link href="/admin/subjects">사람 목록</Link>
      </p>
      <h1 style={{ fontSize: 20 }}>동명이인 병합</h1>
      {effectiveError && ERROR_MESSAGES[effectiveError] && (
        <p style={{ color: "#c0392b" }}>{ERROR_MESSAGES[effectiveError]}</p>
      )}

      {source && target && counts ? (
        <>
          <p>
            <strong>
              {source.displayId} · {source.name}
            </strong>
            을(를){" "}
            <strong>
              {target.displayId} · {target.name}
            </strong>
            으로 합칩니다.
          </p>
          <div className="card">
            <p style={{ fontSize: 13, marginTop: 0 }}>
              로그인 계정 — {source.name}: {accountLabel(source)} · {target.name}: {accountLabel(target)}
            </p>
            <p style={{ fontWeight: 600 }}>
              {source.name}을(를) 가리키던 다음 항목이 {target.name}(으)로 옮겨갑니다
            </p>
            <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.9 }}>
              <li>제기한 상담·수요: {counts.raisedNeeds}건</li>
              <li>대상(수혜) 상담·수요: {counts.beneficiaryNeeds}건</li>
              <li>주최한 활동: {counts.organizedActivities}건</li>
              <li>참여 배정: {counts.activityAssignments}건</li>
              <li>기여: {counts.contributions}건</li>
              <li>연결된 로그인 계정: {counts.linkedAccounts}개</li>
            </ul>
            <p style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
              {source.name} 자체의 지역·전문영역·연락처 등 정보는 옮겨지지 않습니다 — 필요하면
              합치기 전에 {target.name} 쪽 정보를 직접 고쳐두세요. 이름이 다르면{" "}
              {source.name}은(는) {target.name}의 "이전 이름"으로 남습니다. 병합 후{" "}
              {source.name}은(는) 삭제되지 않고 보관(archive) 처리됩니다.
            </p>
          </div>
          <form method="POST" action="/api/admin/subjects/merge" style={{ marginTop: 16 }}>
            <input type="hidden" name="sourceId" value={source.id} />
            <input type="hidden" name="targetId" value={target.id} />
            <button type="submit" style={{ padding: "10px 16px", fontSize: 16 }}>
              병합 확정
            </button>{" "}
            <Link href="/admin/subjects/merge" className="btn-outline" style={{ padding: "10px 16px" }}>
              취소
            </Link>
          </form>
        </>
      ) : (
        <form method="GET" action="/admin/subjects/merge" className="card">
          <label htmlFor="sourceId" style={{ display: "block", fontSize: 14, marginBottom: 4 }}>
            병합할 사람 (없앨 쪽 — 보관 처리됨)
          </label>
          <select
            id="sourceId"
            name="sourceId"
            required
            style={{ width: "100%", padding: 10, fontSize: 16, marginBottom: 12 }}
          >
            <option value="">선택하세요</option>
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.displayId} · {person.name}
                {person.region ? ` (${person.region})` : ""} · 계정: {accountLabel(person)}
              </option>
            ))}
          </select>

          <label htmlFor="targetId" style={{ display: "block", fontSize: 14, marginBottom: 4 }}>
            합칠 대상 (남길 쪽)
          </label>
          <select
            id="targetId"
            name="targetId"
            required
            style={{ width: "100%", padding: 10, fontSize: 16, marginBottom: 16 }}
          >
            <option value="">선택하세요</option>
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.displayId} · {person.name}
                {person.region ? ` (${person.region})` : ""} · 계정: {accountLabel(person)}
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
