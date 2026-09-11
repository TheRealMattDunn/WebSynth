import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

/**
 * Layer boundaries, enforced by lint rather than by good intentions.
 *
 *   core  ←  audio  ←  ui  ←  app
 *
 * Dependencies point one way only. `core` is pure domain and knows nothing about
 * how sound is made or drawn; `audio` may use the domain but never React; `ui`
 * drives both. See docs/adr/0001-layering.md.
 */
/**
 * @param {string[]} groups
 * @param {string} message
 * @returns {import('eslint').Linter.RulesRecord}
 */
const forbid = (groups, message) => ({
  'no-restricted-imports': ['error', { patterns: [{ group: groups, message }] }],
});

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'node_modules'] },

  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,

  {
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { fixStyle: 'inline-type-imports' },
      ],
      eqeqeq: ['error', 'always'],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },

  // ---- Layer boundaries -------------------------------------------------

  {
    files: ['src/core/**/*.ts'],
    rules: forbid(
      [
        'react',
        'react-dom',
        'react/*',
        'zustand/react',
        '@/audio/*',
        '@/ui/*',
        '@/app/*',
      ],
      'core/ is pure domain: no React, no audio implementation, no UI. Move this logic outward instead.',
    ),
  },
  {
    files: ['src/audio/**/*.ts'],
    rules: forbid(
      ['react', 'react-dom', 'react/*', 'zustand', 'zustand/*', '@/ui/*', '@/app/*'],
      'audio/ runs next to the audio thread and must stay framework-free. Expose a method on AudioEngine and let the UI call it.',
    ),
  },
  {
    files: ['src/ui/**/*.{ts,tsx}'],
    rules: forbid(['@/app/*'], 'ui/ must not reach back into app/ wiring.'),
  },

  // ---- React ------------------------------------------------------------

  {
    files: ['src/**/*.tsx'],
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },

  // ---- AudioWorklet global scope ----------------------------------------

  {
    files: ['src/audio/worklets/**/*.ts'],
    languageOptions: {
      // Worklets run in AudioWorkletGlobalScope: no window, no DOM, no timers.
      globals: {
        AudioWorkletProcessor: 'readonly',
        registerProcessor: 'readonly',
        currentFrame: 'readonly',
        currentTime: 'readonly',
        sampleRate: 'readonly',
      },
    },
  },

  // ---- Config + test files ----------------------------------------------

  {
    files: ['*.config.{js,ts}', 'scripts/**/*.{js,ts}'],
    languageOptions: { globals: { ...globals.node } },
    rules: { 'no-console': 'off' },
  },
  {
    files: ['src/**/*.test.ts'],
    rules: { '@typescript-eslint/no-non-null-assertion': 'off' },
  },

  prettier,
);
