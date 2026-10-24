import type { ShippedRule } from '../../catalog.ts'
import { buildShippedRule } from '../factories/shipped-rule-factories.ts'
import { TEST_FILE_GLOBS } from './test-file-globs.ts'

/** The rules eslint-plugin-unicorn 78 adds, both opt-in upstream, each with how we ship it: `null` for in no ruleset. */
export const RULES_UNICORN_78_ADDS: Readonly<Record<string, ShippedRule | null>> = {
  'unicorn/no-repeated-call-wrappers': buildShippedRule('redundancy', { ignores: TEST_FILE_GLOBS }),
  'unicorn/no-unnecessary-default-arguments': null,
}
