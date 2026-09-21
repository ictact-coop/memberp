import Link from "next/link";
import { requireRole } from "@/lib/auth/roles";
import { prisma } from "@/lib/prisma";
import {
  CLASSIFICATION_DOMAINS,
  CLASSIFICATION_DOMAIN_LABELS,
  isClassificationDomain,
} from "@/lib/classification-labels";

const ERROR_MESSAGES: Record<string, string> = {
  invalid: "종류와 합칠 분류 두 항목을 모두 선택하세요.",
  same_classification: "같은 분류를 병합할 수는 없습니다.",
  not_found: "선택한 분류를 확인할 수 없습니다.",
  domain_mismatch: "같은 종류(지역/전문영역)끼리만 합칠 수 있습니다.",
  target_inactive: "합칠 대상(남길 쪽)은 사용 중지된 분류로 지정할 수 없습니다. 먼저 다시 사용으로 바꾸세요.",
};

// 분류 병합 — 같은 종류 안에서 중복 등록된 분류 두 항목을 하나로 합친다
// ("아직 없는 것"의 "분류 도메인 확장·병합" 중 병합 부분). 이 분류를 이미 쓰고
// 있던 사람·기구의 Subject.region/expertiseTags 값도 함께 옮기고, 없앨 쪽은
// 삭제 대신 사용 중지된다.
export default async function MergeClassificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ domain?: string; sourceId?: string; targetId?: string; error?: string }>;
}) {
  await requireRole(["SECRETARIAT", "SYSTEM_ADMIN"]);
  const { domain, sourceId, targetId, error } = await searchParams;

  if (!domain || !isClassificationDomain(domain)) {
    return (
      <section>
        <p style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
          <Link href="/admin/classifications">분류 관리</Link>
        </p>
        <h1 style={{ fontSize: 20 }}>분류 병합</h1>
        <p style={{ color: "var(--color-text-muted)", fontSize: 13 }}>
          먼저 합칠 분류의 종류를 고르세요. 서로 다른 종류끼리는 합칠 수 없습니다.
        </p>
        <form method="GET" action="/admin/classifications/merge" className="card">
          <label htmlFor="domain" style={{ display: "block", fontSize: 14, marginBottom: 4 }}>
            종류
          </label>
          <select id="domain" name="domain" required style={{ width: "100%", padding: 10, fontSize: 16, marginBottom: 16 }}>
            <option value="">선택하세요</option>
            {CLASSIFICATION_DOMAINS.map((d) => (
              <option key={d} value={d}>
                {CLASSIFICATION_DOMAIN_LABELS[d]}
              </option>
            ))}
          </select>
          <button type="submit" style={{ padding: "10px 16px", fontSize: 16 }}>
            다음
          </button>
        </form>
      </section>
    );
  }

  const items = await prisma.classification.findMany({
    where: { domain },
    orderBy: [{ active: "desc" }, { label: "asc" }],
  });

  let previewError: string | null = null;
  if (sourceId && targetId && sourceId === targetId) previewError = "same_classification";
  const source =
    sourceId && targetId && !previewError ? items.find((c) => c.id === sourceId) : undefined;
  const target =
    sourceId && targetId && !previewError ? items.find((c) => c.id === targetId) : undefined;
  if (sourceId && targetId && !previewError && (!source || !target)) {
    previewError = "not_found";
  }
  const effectiveError = error ?? previewError ?? undefined;

  const counts =
    source && target
      ? await Promise.all([
          domain === "REGION"
            ? prisma.subject.count({ where: { region: source.label } })
            : prisma.subject.count({ where: { expertiseTags: { has: source.label } } }),
          prisma.activityClassification.count({ where: { classificationId: source.id } }),
        ])
      : null;

  return (
    <section>
      <p style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
        <Link href="/admin/classifications">분류 관리</Link>
      </p>
      <h1 style={{ fontSize: 20 }}>분류 병합 — {CLASSIFICATION_DOMAIN_LABELS[domain]}</h1>
      {effectiveError && ERROR_MESSAGES[effectiveError] && (
        <p style={{ color: "#c0392b" }}>{ERROR_MESSAGES[effectiveError]}</p>
      )}

      {source && target && counts ? (
        <>
          <p>
            <strong>{source.label}</strong>을(를) <strong>{target.label}</strong>으로 합칩니다.
          </p>
          <div className="card">
            <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.9 }}>
              <li>이 라벨을 쓰는 사람·기구: {counts[0]}건 (모두 &quot;{target.label}&quot;로 바뀝니다)</li>
              <li>이 분류가 붙은 활동: {counts[1]}건</li>
            </ul>
            <p style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
              병합 후 {source.label}은(는) 삭제되지 않고 사용 중지 처리됩니다 — 새로 고를 때는
              선택지에서 빠지지만, 이미 옮겨진 값은 모두 {target.label}로 남습니다.
            </p>
          </div>
          <form method="POST" action="/api/admin/classifications/merge" style={{ marginTop: 16 }}>
            <input type="hidden" name="sourceId" value={source.id} />
            <input type="hidden" name="targetId" value={target.id} />
            <button type="submit" style={{ padding: "10px 16px", fontSize: 16 }}>
              병합 확정
            </button>{" "}
            <Link
              href={`/admin/classifications/merge?domain=${domain}`}
              className="btn-outline"
              style={{ padding: "10px 16px" }}
            >
              취소
            </Link>
          </form>
        </>
      ) : (
        <form method="GET" action="/admin/classifications/merge" className="card">
          <input type="hidden" name="domain" value={domain} />
          <label htmlFor="sourceId" style={{ display: "block", fontSize: 14, marginBottom: 4 }}>
            병합할 분류 (없앨 쪽 — 사용 중지됨)
          </label>
          <select id="sourceId" name="sourceId" required style={{ width: "100%", padding: 10, fontSize: 16, marginBottom: 12 }}>
            <option value="">선택하세요</option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label} ({item.code}){!item.active && " · 사용 중지됨"}
              </option>
            ))}
          </select>

          <label htmlFor="targetId" style={{ display: "block", fontSize: 14, marginBottom: 4 }}>
            합칠 대상 (남길 쪽 — 반드시 사용 중인 분류)
          </label>
          <select id="targetId" name="targetId" required style={{ width: "100%", padding: 10, fontSize: 16, marginBottom: 16 }}>
            <option value="">선택하세요</option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label} ({item.code}){!item.active && " · 사용 중지됨"}
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
