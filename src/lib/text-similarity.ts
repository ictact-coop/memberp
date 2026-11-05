// 기구·사람·분류 병합 화면 공통 — 병합 후보를 관리자가 전체 목록에서 직접
// 찾아야 했던 것을 고친다("아직 없는 것"에 있던 틈). 외부 유사도 라이브러리
// 없이 레벤슈타인 거리만으로 "이름이 완전히 같거나 비슷한 쌍"을 찾는다 —
// 흔한 중복 패턴(철자 그대로인데 띄어쓰기만 다름, "서울"/"서울시"처럼 접미사
// 차이, 단순 오타)을 잡기엔 이 정도로 충분하고, 조합 규모(사람·기구·분류 각각
// 많아야 수백 건)에서 모든 쌍을 비교(O(n²))해도 느리지 않다.
function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let previousRow: number[] = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 0; i < a.length; i++) {
    const currentRow: number[] = [i + 1];
    for (let j = 0; j < b.length; j++) {
      const insertCost = currentRow[j]! + 1;
      const deleteCost = previousRow[j + 1]! + 1;
      const substituteCost = previousRow[j]! + (a[i] === b[j] ? 0 : 1);
      currentRow.push(Math.min(insertCost, deleteCost, substituteCost));
    }
    previousRow = currentRow;
  }
  return previousRow[b.length]!;
}

// 공백 차이·대소문자(영문 코드 등에 섞여 있을 수 있는)는 중복 여부 판단에
// 의미가 없다고 보고 비교 전에 정규화한다. 둘 다 빈 문자열이면(이론상만
// 가능 — 이름·라벨은 필수 필드다) 비슷하다고 보지 않는다.
export function textSimilarity(a: string, b: string): number {
  const normA = a.trim().toLowerCase().replace(/\s+/g, "");
  const normB = b.trim().toLowerCase().replace(/\s+/g, "");
  if (!normA || !normB) return 0;
  if (normA === normB) return 1;
  const distance = levenshteinDistance(normA, normB);
  return 1 - distance / Math.max(normA.length, normB.length);
}

export interface SimilarPair<T> {
  a: T;
  b: T;
  score: number;
}

// threshold 미만은 버리고, 점수 높은 순으로 최대 limit개만 돌려준다 — 목록이
// 길어져도 화면에 수십 개씩 쏟아지지 않게 한다.
export function findSimilarPairs<T>(
  items: readonly T[],
  getText: (item: T) => string,
  { threshold = 0.6, limit = 10 }: { threshold?: number; limit?: number } = {},
): SimilarPair<T>[] {
  const pairs: SimilarPair<T>[] = [];
  for (let i = 0; i < items.length; i++) {
    const a = items[i]!;
    for (let j = i + 1; j < items.length; j++) {
      const b = items[j]!;
      const score = textSimilarity(getText(a), getText(b));
      if (score >= threshold) {
        pairs.push({ a, b, score });
      }
    }
  }
  return pairs.sort((x, y) => y.score - x.score).slice(0, limit);
}
