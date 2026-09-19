import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/roles";
import { prisma } from "@/lib/prisma";
import { VISIBILITY_LABELS } from "@/lib/activity-labels";

const ERROR_MESSAGES: Record<string, string> = {
  invalid: "기구 이름을 입력하세요.",
  invalid_responsible: "선택한 책임 담당자 계정을 확인할 수 없습니다.",
  invalid_region: "선택한 지역을 확인할 수 없습니다.",
  invalid_expertise_tag: "선택한 전문영역·관심 중 확인할 수 없는 값이 있습니다.",
};

// 기구 정보 수정 — 등록 화면(/admin/org-units)과 같은 필드를 그대로 다시
// 보여준다("아직 없는 것"에 남아 있던 틈을 채운다). 보관(archive)은 이 화면이
// 아니라 목록 화면의 별도 버튼으로 처리한다 — 정보 수정과 보관 여부는 서로
// 다른 결정이라 한 폼에 묶지 않는다.
export default async function EditOrgUnitPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  await requireRole(["SECRETARIAT", "SYSTEM_ADMIN"]);
  const { id } = await params;
  const { error } = await searchParams;

  const orgUnit = await prisma.subject.findUnique({ where: { id } });
  if (!orgUnit || orgUnit.type !== "ORG_UNIT") {
    notFound();
  }

  const [accounts, regionOptions, expertiseOptions] = await Promise.all([
    prisma.account.findMany({
      where: { status: "ACTIVE" },
      orderBy: { email: "asc" },
      select: { id: true, email: true, phone: true },
    }),
    prisma.classification.findMany({ where: { domain: "REGION", active: true }, orderBy: { label: "asc" } }),
    prisma.classification.findMany({
      where: { domain: "EXPERTISE", active: true },
      orderBy: { label: "asc" },
    }),
  ]);
  const regionLabels = new Set(regionOptions.map((o) => o.label));
  const legacyRegion = orgUnit.region && !regionLabels.has(orgUnit.region) ? orgUnit.region : null;
  const expertiseLabels = new Set(expertiseOptions.map((o) => o.label));
  const legacyExpertiseTags = orgUnit.expertiseTags.filter((tag) => !expertiseLabels.has(tag));

  return (
    <section>
      <h1 style={{ fontSize: 20 }}>기구 정보 수정</h1>
      <p style={{ fontSize: 12, color: "#888888" }}>{orgUnit.displayId}</p>
      {error && ERROR_MESSAGES[error] && <p style={{ color: "#c0392b" }}>{ERROR_MESSAGES[error]}</p>}

      <form method="POST" action={`/api/admin/org-units/${orgUnit.id}/update`}>
        <label htmlFor="name" style={{ display: "block", fontSize: 14, marginBottom: 4 }}>
          이름
        </label>
        <input
          id="name"
          name="name"
          required
          defaultValue={orgUnit.name}
          style={{ width: "100%", padding: 10, fontSize: 16, marginBottom: 12 }}
        />

        <label htmlFor="region" style={{ display: "block", fontSize: 14, marginBottom: 4 }}>
          지역 (선택)
        </label>
        <select
          id="region"
          name="region"
          defaultValue={orgUnit.region ?? ""}
          style={{ width: "100%", padding: 10, fontSize: 16, marginBottom: 12 }}
        >
          <option value="">선택 안 함</option>
          {legacyRegion && <option value={legacyRegion}>{legacyRegion} (목록에 없음)</option>}
          {regionOptions.map((option) => (
            <option key={option.id} value={option.label}>
              {option.label}
            </option>
          ))}
        </select>

        <fieldset style={{ border: "1px solid #e0e0e0", padding: 10, marginBottom: 12 }}>
          <legend style={{ fontSize: 14 }}>전문영역·관심 (선택)</legend>
          {expertiseOptions.length === 0 && legacyExpertiseTags.length === 0 ? (
            <p style={{ fontSize: 12, color: "#888888", margin: 0 }}>등록된 분류가 없습니다.</p>
          ) : (
            <>
              {expertiseOptions.map((option) => (
                <label key={option.id} style={{ display: "block", fontSize: 14, padding: "4px 0" }}>
                  <input
                    type="checkbox"
                    name="expertiseTags"
                    value={option.label}
                    defaultChecked={orgUnit.expertiseTags.includes(option.label)}
                  />{" "}
                  {option.label}
                </label>
              ))}
              {legacyExpertiseTags.map((tag) => (
                <label key={tag} style={{ display: "block", fontSize: 14, padding: "4px 0" }}>
                  <input type="checkbox" name="expertiseTags" value={tag} defaultChecked /> {tag}{" "}
                  <span style={{ fontSize: 12, color: "#888888" }}>(목록에 없음)</span>
                </label>
              ))}
            </>
          )}
        </fieldset>

        <label htmlFor="responsibleAccountId" style={{ display: "block", fontSize: 14, marginBottom: 4 }}>
          책임 담당자 (선택)
        </label>
        <select
          id="responsibleAccountId"
          name="responsibleAccountId"
          defaultValue={orgUnit.responsibleAccountId ?? ""}
          style={{ width: "100%", padding: 10, fontSize: 16, marginBottom: 12 }}
        >
          <option value="">선택 안 함</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.email ?? account.phone}
            </option>
          ))}
        </select>

        <label htmlFor="visibility" style={{ display: "block", fontSize: 14, marginBottom: 4 }}>
          공개 범위
        </label>
        <select
          id="visibility"
          name="visibility"
          defaultValue={orgUnit.visibility}
          style={{ width: "100%", padding: 10, fontSize: 16, marginBottom: 16 }}
        >
          {Object.entries(VISIBILITY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        <button type="submit" style={{ padding: "10px 16px", fontSize: 16 }}>
          저장
        </button>
      </form>
    </section>
  );
}
