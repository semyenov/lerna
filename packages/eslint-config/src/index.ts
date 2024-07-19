import { presetAll, sxzz } from '@sxzz/eslint-config'
import pluginSecurity from 'eslint-plugin-security'

const config = sxzz(
  [
    ...presetAll,
    pluginSecurity.configs.recommended,
    {
      rules: {
        'no-duplicate-imports': 'error',
        strict: 'error',
        'no-var': 'error',
        'prefer-const': 'error',
        'no-console': 'error',
        'no-debugger': 'error',
        'no-alert': 'error',
        eqeqeq: ['error', 'always'],
        curly: 'error',
        'default-case': 'error',
        'no-fallthrough': 'error',
        'no-eval': 'error',
        'no-implied-eval': 'error',
        'no-new-func': 'error',
        'no-param-reassign': 'error',
        'no-return-assign': 'error',
        'no-script-url': 'error',
        'no-self-compare': 'error',
        'no-sequences': 'error',
        'no-throw-literal': 'error',
        radix: 'error',
        yoda: 'error',

        'unused-imports/no-unused-imports': 'warn',
        'no-unused-vars': 'warn',

        'require-await': 'off',

        'eslint-comments/no-unlimited-disable': 'error',
        'import/namespace': ['error', { allowComputed: false }],
        'import/order': [
          'error',
          {
            'newlines-between': 'always',
            distinctGroup: true,
            groups: [
              'builtin',
              'external',
              'object',
              'parent',
              'internal',
              'sibling',
              'index',
              'type',
            ],
            pathGroups: [
              {
                pattern: '@regioni/*',
                group: 'sibling',
                position: 'after',
              },
              {
                pattern: '@regioni/lib/*',
                group: 'sibling',
                position: 'after',
              },
              {
                pattern: '~/**',
                group: 'internal',
                position: 'after',
              },
            ],
            alphabetize: {
              order: 'asc',
              orderImportKind: 'asc',
              caseInsensitive: true,
            },
          },
        ],
      },
    },
  ],
  {
    prettier: true,
    sortKeys: true,
    command: true,
  },
)

export default config
