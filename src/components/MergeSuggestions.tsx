import Link from "next/link";
import type { SimilarPair } from "@/lib/text-similarity";

// 기구·사람·분류 병합 화면 세 곳이 공유하는 "이름이 비슷한 후보" 카드.
// 무엇을 비교했는지(이름 vs 라벨), 링크를 어떻게 만드는지만 화면마다 다르다.
export function MergeSuggestions<T>({
  pairs,
  renderLabel,
  buildHref,
}: {
  pairs: SimilarPair<T>[];
  renderLabel: (item: T) => string;
  buildHref: (a: T, b: T) => string;
}) {
  if (pairs.length === 0) return null;

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <p style={{ fontWeight: 600, marginTop: 0, fontSize: 14 }}>이름이 비슷한 후보</p>
      <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, lineHeight: 1.9 }}>
        {pairs.map(({ a, b }, i) => (
          <li key={i}>
            {renderLabel(a)} ↔ {renderLabel(b)}{" "}
            <Link href={buildHref(a, b)} style={{ fontWeight: 600 }}>
              이 둘 병합하기 →
            </Link>
          </li>
        ))}
      </ul>
      <p style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 0 }}>
        이름이 완전히 같거나 철자가 비슷한 쌍만 자동으로 찾아 보여줍니다 — 실제로 같은
        대상인지는 확인 화면에서 직접 판단하세요.
      </p>
    </div>
  );
}
