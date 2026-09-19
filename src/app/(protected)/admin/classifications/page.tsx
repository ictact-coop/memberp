import { requireRole } from "@/lib/auth/roles";
import { prisma } from "@/lib/prisma";
import {
  CLASSIFICATION_DOMAINS,
  CLASSIFICATION_DOMAIN_LABELS,
} from "@/lib/classification-labels";

const ERROR_MESSAGES: Record<string, string> = {
  invalid: "코드와 라벨을 모두 입력하세요.",
  invalid_domain: "분류 종류를 확인할 수 없습니다.",
  duplicate: "그 종류에 같은 코드가 이미 있습니다.",
};

// 분류 관리 — 지역·전문영역/관심을 자유 텍스트 대신 정식 분류표에서 고르게
// 하기 위한 화면. `Classification`은 R1 스키마 설계 때부터 있었지만 이번에
// 처음 실제로 쓴다. SECRETARIAT/SYSTEM_ADMIN만 들어올 수 있다(다른 관리
// 화면과 같은 권한).
export default async function ClassificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireRole(["SECRETARIAT", "SYSTEM_ADMIN"]);
  const { error } = await searchParams;

  const classifications = await prisma.classification.findMany({
    orderBy: [{ domain: "asc" }, { label: "asc" }],
  });

  return (
    <section>
      <h1 style={{ fontSize: 20 }}>분류 관리</h1>
      {error && ERROR_MESSAGES[error] && <p style={{ color: "#c0392b" }}>{ERROR_MESSAGES[error]}</p>}

      <h2 style={{ fontSize: 16 }}>새 분류 등록</h2>
      <form method="POST" action="/api/admin/classifications/create" style={{ marginBottom: 24 }}>
        <label htmlFor="domain" style={{ display: "block", fontSize: 14, marginBottom: 4 }}>
          종류
        </label>
        <select
          id="domain"
          name="domain"
          required
          style={{ width: "100%", padding: 10, fontSize: 16, marginBottom: 12 }}
        >
          {CLASSIFICATION_DOMAINS.map((domain) => (
            <option key={domain} value={domain}>
              {CLASSIFICATION_DOMAIN_LABELS[domain]}
            </option>
          ))}
        </select>

        <label htmlFor="code" style={{ display: "block", fontSize: 14, marginBottom: 4 }}>
          코드 (영문, 예: SEOUL)
        </label>
        <input
          id="code"
          name="code"
          required
          style={{ width: "100%", padding: 10, fontSize: 16, marginBottom: 12 }}
        />

        <label htmlFor="label" style={{ display: "block", fontSize: 14, marginBottom: 4 }}>
          화면에 보일 이름 (예: 서울)
        </label>
        <input
          id="label"
          name="label"
          required
          style={{ width: "100%", padding: 10, fontSize: 16, marginBottom: 16 }}
        />

        <button type="submit" style={{ padding: "10px 16px", fontSize: 16 }}>
          등록
        </button>
      </form>

      {CLASSIFICATION_DOMAINS.map((domain) => {
        const items = classifications.filter((item) => item.domain === domain);
        return (
          <div key={domain} style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 16 }}>{CLASSIFICATION_DOMAIN_LABELS[domain]}</h2>
            {items.length === 0 ? (
              <p style={{ color: "#555555" }}>등록된 분류가 없습니다.</p>
            ) : (
              <ul style={{ listStyle: "none", padding: 0 }}>
                {items.map((item) => (
                  <li
                    key={item.id}
                    style={{
                      borderBottom: "1px solid #e0e0e0",
                      padding: "10px 0",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <div>
                      <strong>{item.label}</strong>{" "}
                      <span style={{ fontSize: 12, color: "#888888" }}>{item.code}</span>
                      {!item.active && (
                        <span style={{ fontSize: 12, color: "#888888" }}> — 사용 중지됨</span>
                      )}
                    </div>
                    <form
                      method="POST"
                      action={`/api/admin/classifications/${item.id}/${item.active ? "deactivate" : "activate"}`}
                    >
                      <button type="submit" style={{ fontSize: 13, padding: "4px 10px" }}>
                        {item.active ? "사용 중지" : "다시 사용"}
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </section>
  );
}
