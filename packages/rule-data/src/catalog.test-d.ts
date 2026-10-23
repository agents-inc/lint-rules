// Never run: typecheck fails when an `@ts-expect-error` below stops meeting a type error, or an allowed call beside it
// stops compiling. A route's engine decides its oxlint name and plugin: a route oxlint runs carries both, one ESLint
// runs neither. Only reading the generated routing checks it at run time (parseRuleRoute, catalog.test.ts).
import { buildEslintRoute, buildOxlintRoute } from './__tests__/factories/inventory-factories.ts'
import { isOxlintRoute } from './catalog.ts'

const OXLINT_ROUTE = buildOxlintRoute('plugin/oxlint-rule', {
  oxlintName: 'plugin/oxlint-rule',
  oxlintPlugin: 'plugin',
  eslintAliases: [],
  oxlintSpellings: [],
  shipped: null,
})
const ESLINT_ROUTE = buildEslintRoute('plugin/eslint-rule', { typed: false, oxlintSpellings: [], shipped: null })

isOxlintRoute(OXLINT_ROUTE)

isOxlintRoute(ESLINT_ROUTE)

// @ts-expect-error a route oxlint runs carries an oxlint name
isOxlintRoute({ ...OXLINT_ROUTE, oxlintName: null })

// @ts-expect-error a route oxlint runs carries an oxlint plugin
isOxlintRoute({ ...OXLINT_ROUTE, oxlintPlugin: null })

// @ts-expect-error a route ESLint runs carries no oxlint name
isOxlintRoute({ ...ESLINT_ROUTE, oxlintName: 'plugin/eslint-rule' })

// @ts-expect-error a route ESLint runs carries no oxlint plugin
isOxlintRoute({ ...ESLINT_ROUTE, oxlintPlugin: 'plugin' })
