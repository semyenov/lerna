import config from '@regioni/eslint-config'

/**
 * @type {Linter.FlatConfig<Linter.RulesRecord>[]}
 * @default
 * @export
 * **/

export default [
  ...config,
  {
    ignores: [
      'node_modules',
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
