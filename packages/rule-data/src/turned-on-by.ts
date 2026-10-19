/** What a consumer's `allowSuppressions` says for a file: suppression comments banned (the default) or allowed. */
export type SuppressionMode = 'banned' | 'allowed'

/** A rule's setting in one suppression mode: off, or on at `error` with these options. */
export type SuppressionModeSetting = 'off' | { readonly options: readonly unknown[] }

export type BySuppressionMode<Setting> = { readonly [mode in SuppressionMode]: Setting }

/** A rule's options in test and type-test files while suppressions are banned, as data/rules.json gives them. */
export type TestFileOptions = { readonly options: readonly unknown[] }

/** Those options with the globs of the test and type-test files, as the generated routing and the catalog give them. */
export type TestFileSetting = TestFileOptions & { readonly files: readonly string[] }

/** Each mode's setting and, on a rule that differs there, its setting in test and type-test files while suppressions are banned. */
export type WhenSuppressions<Setting, InTestFiles> = BySuppressionMode<Setting> & { readonly bannedInTestFiles?: InTestFiles }

/** The setting of a rule `allowSuppressions` decides, in each mode. */
export type SettingBySuppressionMode = WhenSuppressions<SuppressionModeSetting, TestFileSetting>

/**
 * What turns a shipped rule on: its ruleset, when a consumer lists it; nothing, for a rule that is on
 * whatever rulesets are listed; or `allowSuppressions`, whatever rulesets are listed. A consumer can
 * turn the first two kinds off by ID in `rules`, and cannot set the third there.
 * `ruleset?: never` lets `ruleset` be read on every kind; `in` tells the other two apart.
 */
export type TurnedOnBy =
  | { ruleset: string }
  | { alwaysOn: true; ruleset?: never }
  | { whenSuppressions: SettingBySuppressionMode; ruleset?: never }

/** A suppression-mode setting as JSON gives it, which types `off` as `string`. */
export type SuppressionModeSettingField = string | { readonly options: readonly unknown[] }

/** The settings as the generated routing gives them. */
export type SettingFieldBySuppressionMode = WhenSuppressions<SuppressionModeSettingField, TestFileSetting | undefined>

/** The three fields as the generated routing gives them; `data/rules.json` gives the first two the same way. */
export type TurnedOnByFields = {
  readonly ruleset?: string | undefined
  readonly alwaysOn?: boolean | undefined
  readonly whenSuppressions?: SettingFieldBySuppressionMode | undefined
}

/**
 * Exactly one of a ruleset, `alwaysOn: true` and `whenSuppressions`. JSON types `true` as `boolean` and
 * `off` as `string`; this narrows them.
 */
export function parseTurnedOnBy(id: string, { ruleset, alwaysOn, whenSuppressions }: TurnedOnByFields): TurnedOnBy {
  const waysGiven = [ruleset !== undefined, alwaysOn === true, whenSuppressions !== undefined].filter(Boolean)
  if (waysGiven.length !== 1) {
    throw new Error(`${id} needs exactly one of a ruleset, alwaysOn: true and whenSuppressions`)
  }
  if (whenSuppressions !== undefined) {
    return {
      whenSuppressions: {
        ...inEachSuppressionMode(whenSuppressions, (setting) => parseSuppressionModeSetting(id, setting)),
        ...testFileSettingOf(whenSuppressions),
      },
    }
  }
  if (ruleset !== undefined) return { ruleset }
  return { alwaysOn: true }
}

export function parseSuppressionModeSetting(id: string, setting: SuppressionModeSettingField): SuppressionModeSetting {
  if (typeof setting !== 'string') return { options: setting.options }
  if (setting === 'off') return setting
  throw new Error(`${id}: "${setting}" is not a suppression-mode setting (off, or { options })`)
}

/** Each mode's setting made from the one given for that mode, `banned` first. */
export function inEachSuppressionMode<Given, Made>(
  settings: BySuppressionMode<Given>,
  settingOf: (setting: Given) => Made,
): BySuppressionMode<Made> {
  return { banned: settingOf(settings.banned), allowed: settingOf(settings.allowed) }
}

/** The test-file setting, where the rule has one: none is no key, as exactOptionalPropertyTypes asks. */
export function testFileSettingOf<InTestFiles>({ bannedInTestFiles }: { readonly bannedInTestFiles?: InTestFiles | undefined }): { readonly bannedInTestFiles?: InTestFiles } {
  return bannedInTestFiles === undefined ? {} : { bannedInTestFiles }
}
