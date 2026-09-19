import { requireRole } from "@/lib/auth/roles";
import { prisma } from "@/lib/prisma";

const ERROR_MESSAGES: Record<string, string> = {
  invalid: "이름을 입력하세요.",
  invalid_region: "선택한 지역을 확인할 수 없습니다.",
  invalid_expertise_tag: "선택한 전문영역·관심 중 확인할 수 없는 값이 있습니다.",
};

// 사람 미리 등록 — 계정(로그인) 없이 사람 정보만 먼저 만들어 둔다. 지금까지
// 사람 주체(Subject type=PERSON)는 초대를 수락할 때만 생길 수 있었다(계정과
// 항상 함께 생성). 이 화면은 그 전제를 깨는 유일한 통로다: 초대장을 보낼 때
// "이미 아는 사람"에게 미리 연결하려면, 연결할 대상 자체가 계정 없이 먼저
// 존재해야 하기 때문이다("초대 관리" 화면의 "미리 연결할 사람" 선택지 참고).
// 본인이 아직 확인하지 않은 정보이므로 상태는 항상 NEEDS_CONFIRMATION으로
// 시작한다 — 초대를 수락해 로그인하면 그 사람 스스로 내 정보 화면에서 확인·
// 수정하는 순간 ACTIVE로 바뀐다(/my/profile과 같은 규칙).
export default async function NewSubjectPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireRole(["SECRETARIAT", "SYSTEM_ADMIN"]);
  const { error } = await searchParams;

  const [regionOptions, expertiseOptions] = await Promise.all([
    prisma.classification.findMany({ where: { domain: "REGION", active: true }, orderBy: { label: "asc" } }),
    prisma.classification.findMany({
      where: { domain: "EXPERTISE", active: true },
      orderBy: { label: "asc" },
    }),
  ]);

  return (
    <section>
      <h1 style={{ fontSize: 20 }}>사람 미리 등록</h1>
      <p style={{ color: "var(--color-text-muted)", fontSize: 13 }}>
        아직 로그인 계정이 없는 사람의 정보를 미리 만들어 둡니다. 나중에 이 사람을 초대하면
        "초대 관리" 화면에서 여기 등록한 사람에게 미리 연결할 수 있습니다.
      </p>
      {error && ERROR_MESSAGES[error] && <p style={{ color: "#c0392b" }}>{ERROR_MESSAGES[error]}</p>}

      <form method="POST" action="/api/admin/subjects/create" className="card">
        <label htmlFor="name" style={{ display: "block", fontSize: 14, marginBottom: 4 }}>
          이름
        </label>
        <input
          id="name"
          name="name"
          required
          style={{ width: "100%", padding: 10, fontSize: 16, marginBottom: 12 }}
        />

        <label htmlFor="region" style={{ display: "block", fontSize: 14, marginBottom: 4 }}>
          지역 (선택)
        </label>
        <select
          id="region"
          name="region"
          defaultValue=""
          style={{ width: "100%", padding: 10, fontSize: 16, marginBottom: 12 }}
        >
          <option value="">선택 안 함</option>
          {regionOptions.map((option) => (
            <option key={option.id} value={option.label}>
              {option.label}
            </option>
          ))}
        </select>

        <fieldset style={{ border: "1px solid #e0e0e0", padding: 10, marginBottom: 12 }}>
          <legend style={{ fontSize: 14 }}>전문영역·관심 (선택)</legend>
          {expertiseOptions.length === 0 ? (
            <p style={{ fontSize: 12, color: "#888888", margin: 0 }}>등록된 분류가 없습니다.</p>
          ) : (
            expertiseOptions.map((option) => (
              <label key={option.id} style={{ display: "block", fontSize: 14, padding: "4px 0" }}>
                <input type="checkbox" name="expertiseTags" value={option.label} /> {option.label}
              </label>
            ))
          )}
        </fieldset>

        <label htmlFor="contact" style={{ display: "block", fontSize: 14, marginBottom: 4 }}>
          연락처 (선택) — 다른 조합원에게 공개되지 않습니다
        </label>
        <input
          id="contact"
          name="contact"
          style={{ width: "100%", padding: 10, fontSize: 16, marginBottom: 16 }}
        />

        <button type="submit" style={{ padding: "10px 16px", fontSize: 16 }}>
          등록
        </button>
      </form>
    </section>
  );
}
