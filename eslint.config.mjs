import nextPlugin from "@next/eslint-plugin-next";
import reactHooks from "eslint-plugin-react-hooks";
import jsxA11y from "eslint-plugin-jsx-a11y";
import tseslint from "typescript-eslint";

// eslint-config-next의 legacy(eslintrc) 브리지는 이 프로젝트의 eslint/typescript-eslint
// 버전 조합에서 순환 참조 직렬화 오류를 일으켜, 필요한 플러그인들의 네이티브 flat config를
// 직접 조합해 쓴다. 접근성(jsx-a11y)은 기획서 v1.0 §10 "키보드 조작, 오류 위치 안내" 요건과
// 직결되어 포함했다.
const eslintConfig = [
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "prisma/migrations/**",
      "next-env.d.ts",
    ],
  },
  ...tseslint.configs.recommended,
  {
    plugins: {
      "@next/next": nextPlugin,
      "react-hooks": reactHooks,
      "jsx-a11y": jsxA11y,
    },
    rules: {
      ...nextPlugin.configs["core-web-vitals"].rules,
      ...reactHooks.configs["recommended-latest"].rules,
      ...jsxA11y.flatConfigs.recommended.rules,
    },
  },
];

export default eslintConfig;
