// The shape of the files plan.md has a consumer write: a default-exported call (which
// unicorn/no-top-level-side-effects reports) of an object whose keys follow the plan rather than
// the alphabet (which perfectionist/sort-objects reports).
export const consumerConfigSource = `import { defineLintRules } from '@agents-inc/lint-rules'

export default defineLintRules({ tsconfigRootDir: import.meta.dirname, rulesets: { quality: ['correctness'], libs: {}, runtimes: ['node'] } })
`
