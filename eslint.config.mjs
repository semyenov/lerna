import config from '@regioni/eslint-config'

/**
 * @typedef {import('eslint').Linter.FlatConfig<Linter.RulesRecord>[]} FlatConfig
 * **/

/** @type {FlatConfig} */
const eslintConfig = [
  ...config,
  {
    ignores: [
      'node_modules',
      'packages/*/node_modules',
      'apps/*/node_modules',
      '.yarn/*',
      'dist',
      'build',
      'public',
      'coverage',
      'cypress',
      'jest',
    ],
  },
]

export default eslintConfig
