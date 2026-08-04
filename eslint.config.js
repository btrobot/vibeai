import typescript from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import reactHooks from 'eslint-plugin-react-hooks';
import noHardcodedColors from './eslint-rules/no-hardcoded-colors.js';

export default [
  {
    ignores: ['dist/**', 'node_modules/**', '*.js', 'scripts/**', 'drizzle/**'],
  },
  {
    files: ['src/**/*.ts', 'src/**/*.tsx', 'server/src/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2024,
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      '@typescript-eslint': typescript,
      'react-hooks': reactHooks,
      'design': { rules: { 'no-hardcoded-colors': noHardcodedColors } },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-console': 'off',
      'react-hooks/exhaustive-deps': 'warn',
      'react-hooks/set-state-in-effect': 'off',
      // DESIGN.md 设计规范强制执行
      'design/no-hardcoded-colors': 'error',
    },
  },
];
