/**
 * The rules eslint-plugin-unicorn 78 adds (its v78.0.0 release notes), both opt-in upstream. The
 * owner approved the upgrade (q-r2-plugin-upgrades), not the rules: no ruleset ships them.
 */
export const RULES_UNICORN_78_ADDS: readonly string[] = [
  'unicorn/no-repeated-call-wrappers',
  'unicorn/no-unnecessary-default-arguments',
]
