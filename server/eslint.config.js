import js from '@eslint/js';

export default [
  { ignores: ['data/**', 'coverage/**'] },
  js.configs.recommended,
  { languageOptions: { ecmaVersion: 2024, sourceType: 'module', globals: { console: 'readonly', process: 'readonly', Buffer: 'readonly', AbortSignal: 'readonly' } }, rules: { 'no-unused-vars': ['error', { argsIgnorePattern: '^_' }] } }
];
