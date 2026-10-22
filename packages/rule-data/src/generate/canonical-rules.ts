import rules from '../../data/rules.json' with { type: 'json' }

import { parseEngine } from '../parse-names.ts'
import {
  type SuppressionModeSettingField,
  type TestFileOptions,
  type WhenSuppressions,
  parseSuppressionModeSetting,
  whenSuppressionsParsedBy,
} from '../turned-on-by.ts'
import type { CanonicalRule, CanonicalSuppressionModeSetting } from './build-routing.ts'

/** `whenSuppressions` as data/rules.json gives it, which types `off` as `string`. */
type WhenSuppressionsField = WhenSuppressions<SuppressionModeSettingField, TestFileOptions>

/**
 * An entry of `data/rules.json` before its names are narrowed. Declared rather than inferred: JSON infers a
 * field only while some rule in today's data uses it.
 */
type CanonicalRuleField = Omit<CanonicalRule, 'engine' | 'whenSuppressions'> & {
  readonly engine: string
  readonly whenSuppressions?: WhenSuppressionsField
}

/** The canonical list. Its invariants are checked by canonical-list.test.ts, not at load. */
export const canonicalRules: readonly CanonicalRule[] = rules.map(parseCanonicalRule)

function parseCanonicalRule({ whenSuppressions, ...rule }: CanonicalRuleField): CanonicalRule {
  return { ...rule, engine: parseEngine(rule.engine), ...whenSuppressionsOf(rule.id, whenSuppressions) }
}

function whenSuppressionsOf(
  id: string,
  field: WhenSuppressionsField | undefined,
): Pick<CanonicalRule, 'whenSuppressions'> {
  if (field === undefined) return {}
  return { whenSuppressions: whenSuppressionsParsedBy(field, (setting) => parseCanonicalSetting(id, setting)) }
}

function parseCanonicalSetting(id: string, setting: SuppressionModeSettingField): CanonicalSuppressionModeSetting {
  return setting === 'on' ? setting : parseSuppressionModeSetting(id, setting)
}
