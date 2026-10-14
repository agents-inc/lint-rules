// Every category oxlint enables rules by. Off, so a config runs exactly the rules it names.
const OXLINT_CATEGORIES = ['correctness', 'suspicious', 'pedantic', 'style', 'nursery', 'restriction', 'perf']
const DENY = 'deny'
const ERROR = 'error'
const JSON_INDENT = 2

type OxlintConfigFile = {
  plugins: readonly string[]
  categories: Readonly<Record<string, string>>
  rules: Readonly<Record<string, string>>
}

/**
 * An oxlint config turning on each rule key, as written, and nothing else. oxlint ignores a rule
 * whose plugin is not listed, so the plugins are required.
 */
export function buildOxlintConfigEnabling(
  ruleKeys: readonly string[],
  { plugins }: { plugins: readonly string[] },
): OxlintConfigFile {
  return {
    plugins,
    categories: Object.fromEntries(OXLINT_CATEGORIES.map((category) => [category, 'off'])),
    rules: Object.fromEntries(ruleKeys.map((ruleKey) => [ruleKey, ERROR])),
  }
}

/** What `oxlint --print-config` prints: every rule it resolved, under its native name, at `deny`. */
export function buildPrintedOxlintConfig(nativeRuleNames: readonly string[]): string {
  const printed = {
    plugins: [],
    categories: {},
    rules: Object.fromEntries(nativeRuleNames.map((name) => [name, DENY])),
    settings: {},
    env: { builtin: true },
    globals: {},
    ignorePatterns: [],
  }
  return JSON.stringify(printed, null, JSON_INDENT)
}

/** Printed output with no `rules` object, which a config oxlint loaded never produces. */
export function buildPrintedOutputWithoutRules(): string {
  return JSON.stringify({ plugins: [], env: { builtin: true } })
}

/** An oxlint config running each rule given only in the files its globs match, and nothing by category. */
export function buildOxlintConfigRunningEachRuleIn(
  ruleFiles: readonly { readonly files: readonly string[]; readonly rule: string; readonly options: readonly unknown[] | undefined }[],
  { plugins }: { plugins: readonly string[] },
): Omit<OxlintConfigFile, 'rules'> & { overrides: { files: readonly string[]; rules: Readonly<Record<string, unknown>> }[] } {
  return {
    plugins,
    categories: Object.fromEntries(OXLINT_CATEGORIES.map((category) => [category, 'off'])),
    overrides: ruleFiles.map(({ files, rule, options }) => ({ files, rules: { [rule]: options === undefined ? ERROR : [ERROR, ...options] } })),
  }
}

/** An oxlint config running the rule given with the options given, and nothing by category. */
export function buildOxlintConfigRunningTheRuleWith(
  rule: string,
  options: readonly unknown[],
  { plugins }: { plugins: readonly string[] },
): Omit<OxlintConfigFile, 'rules'> & { rules: Readonly<Record<string, readonly unknown[]>> } {
  return {
    plugins,
    categories: Object.fromEntries(OXLINT_CATEGORIES.map((category) => [category, 'off'])),
    rules: { [rule]: [ERROR, ...options] },
  }
}
