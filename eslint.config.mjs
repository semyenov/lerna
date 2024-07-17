import config from '@regioni/eslint-config'

/**
 * @type {Linter.FlatConfig<Linter.RulesRecord>[]}
 * @default
 * @export
 * **/

export default [
  ...config,
  {
    rules: {
      'require-await': 'off',
    },
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
