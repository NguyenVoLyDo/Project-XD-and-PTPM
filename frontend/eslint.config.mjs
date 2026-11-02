import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';

export default defineConfig([
  ...nextVitals,
  // Existing data-loading effects set loading state before their network calls.
  // Keep migration advice visible while enabling lint for the existing codebase.
  { rules: { 'react-hooks/set-state-in-effect': 'warn' } },
  globalIgnores(['.next/**', 'out/**', 'next-env.d.ts']),
]);
