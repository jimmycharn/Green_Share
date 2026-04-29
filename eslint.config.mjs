import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import prettierConfig from 'eslint-config-prettier';
import reactHooksPlugin from 'eslint-plugin-react-hooks';

const eslintConfig = defineConfig([
  ...nextVitals,

  // Project-wide rule tweaks (only core ESLint rules here — plugin rules
  // like react/* and @next/next/* are configured by eslint-config-next above
  // and can't be redeclared in a separate flat-config block without also
  // re-importing the plugin).
  {
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
      'prefer-const': 'error',
      'no-var': 'error',
      eqeqeq: ['error', 'smart'],
      'no-implicit-coercion': 'warn',

    },
  },

  // Demote React Compiler strict hints (new in React 19 / Next 16) to
  // warnings — they flag pre-existing patterns we'll clean up in Phase 5.
  // See IMPROVEMENT_PLAN.md Phase 5. Plugin must be re-declared here because
  // flat config scopes plugins per config block.
  {
    plugins: { 'react-hooks': reactHooksPlugin },
    rules: {
      'react-hooks/immutability': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
    },
  },

  // Test files: relax some rules
  {
    files: ['tests/**/*', '**/*.test.{js,jsx,ts,tsx}', '**/*.spec.{js,jsx,ts,tsx}'],
    rules: {
      'no-console': 'off',
    },
  },

  // Disable formatting rules that conflict with Prettier (must come last)
  prettierConfig,

  // Ignores
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'coverage/**',
    'next-env.d.ts',
    'Backup/**',
    'Last Version/**',
    'anti_version/**',
    'scratch/**',
    'กำลังทำ/**',
    'Pic/**',
    'cloudflare/**',
    'netlify/**',
    'code.gs',
    'index.html',
    'supabase/migrations/archive/**',
  ]),
]);

export default eslintConfig;
