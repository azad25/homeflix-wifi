import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
  },
  {
    rules: {
      // TypeScript rules
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { 
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_" 
      }],
      
      // React rules
      "react-hooks/exhaustive-deps": ["warn", {
        additionalHooks: "(useIsomorphicLayoutEffect|useRecoilCallback|useRecoilTransactionObserver_UNSTABLE|useRecoilSnapshot|useGotoRecoilSnapshot|useRecoilTransactionObserver_UNSTABLE|useRecoilBridgeAcrossReactRoots_UNSTABLE|useRecoilSnapshot|useGotoRecoilSnapshot|useRecoilTransactionObserver_UNSTABLE|useRecoilBridgeAcrossReactRoots_UNSTABLE|useRecoilCallback|useRecoilTransactionObserver_UNSTABLE|useRecoilSnapshot|useGotoRecoilSnapshot|useRecoilTransactionObserver_UNSTABLE|useRecoilBridgeAcrossReactRoots_UNSTABLE|useRecoilCallback|useRecoilTransactionObserver_UNSTABLE|useRecoilSnapshot|useGotoRecoilSnapshot|useRecoilTransactionObserver_UNSTABLE|useRecoilBridgeAcrossReactRoots_UNSTABLE|useRecoilCallback|useRecoilTransactionObserver_UNSTABLE|useRecoilSnapshot|useGotoRecoilSnapshot|useRecoilTransactionObserver_UNSTABLE|useRecoilBridgeAcrossReactRoots_UNSTABLE)"
      }],
      
      // React specific rules
      "react/jsx-no-target-blank": "off",
      "react/no-unescaped-entities": ["error", { "forbid": [">", "}"] }],
      
      // Next.js specific rules
      "@next/next/no-img-element": "warn",
      
      // General JavaScript rules
      "no-unused-vars": "off", // Handled by @typescript-eslint/no-unused-vars
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      // TypeScript specific rules
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
    },
  },
  {
    files: ["**/__tests__/**/*", "**/*.test.ts", "**/*.test.tsx"],
    rules: {
      // Test specific rules
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
];

export default eslintConfig;
