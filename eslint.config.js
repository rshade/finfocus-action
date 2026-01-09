import js from '@eslint/js';
import typescriptEslint from 'typescript-eslint';
import eslintPluginJest from 'eslint-plugin-jest';

export default [
  js.configs.recommended,
  ...typescriptEslint.configs.recommended,
  eslintPluginJest.configs['flat/recommended'],
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**', '*.config.js'],
  },
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: typescriptEslint.parser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      globals: {
        ...eslintPluginJest.environments.globals.globals,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
];
