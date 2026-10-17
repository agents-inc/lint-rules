// A consumer's config file: a default-exported call (unicorn/no-top-level-side-effects reports it) of
// an object whose keys are unsorted (perfectionist/sort-objects reports it).
export const consumerConfigSource = `import { defineLintRules } from '@agents-inc/lint-rules'

export default defineLintRules({ tsconfigRootDir: import.meta.dirname, rulesets: { quality: ['correctness'], libs: {}, runtimes: ['node'] } })
`
